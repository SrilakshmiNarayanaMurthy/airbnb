const { pool } = require("./db");

async function initSqlSchema() {
  try {
    // listings
    await pool.query(`
      CREATE TABLE IF NOT EXISTS listings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        owner_mongo_id VARCHAR(36) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        price_per_night DECIMAL(10,2) DEFAULT 0,
        max_guests INT DEFAULT 1,
        bedrooms INT DEFAULT 0,
        bathrooms INT DEFAULT 0,
        city VARCHAR(100),
        country VARCHAR(100),
        image_url VARCHAR(255),
        property_type VARCHAR(100),
        amenities TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // bookings
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        listing_id INT NOT NULL,
        user_mongo_id VARCHAR(36) NOT NULL,
        status ENUM('pending','accepted','rejected','cancelled') DEFAULT 'pending',
        check_in DATE,
        check_out DATE,
        guests INT,
        total_price DECIMAL(10,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // listing_blackouts
    await pool.query(`
      CREATE TABLE IF NOT EXISTS listing_blackouts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        listing_id INT NOT NULL,
        start_date DATE,
        end_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // listing_photos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS listing_photos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        listing_id INT NOT NULL,
        url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // favorites
    await pool.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        user_mongo_id VARCHAR(36) NOT NULL,
        listing_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_mongo_id, listing_id),
        FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    console.log("✅ SQL schema ensured");

    // --- Column-level migrations: if existing tables lack our new columns, add them ---
    const dbName = process.env.DB_NAME || "airbnb_lab";

    async function hasColumn(table, column) {
      const [rows] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [dbName, table, column]
      );
      return rows[0].cnt > 0;
    }

    // listings: ensure owner_mongo_id, property_type, amenities exist
    if (!(await hasColumn("listings", "owner_mongo_id"))) {
      await pool.query(`ALTER TABLE listings ADD COLUMN owner_mongo_id VARCHAR(36) NULL`);
      console.log("Added column listings.owner_mongo_id");
    }
    if (!(await hasColumn("listings", "property_type"))) {
      await pool.query(`ALTER TABLE listings ADD COLUMN property_type VARCHAR(100) NULL`);
      console.log("Added column listings.property_type");
    }
    if (!(await hasColumn("listings", "amenities"))) {
      await pool.query(`ALTER TABLE listings ADD COLUMN amenities TEXT NULL`);
      console.log("Added column listings.amenities");
    }

    // bookings: ensure user_mongo_id exists
    if (!(await hasColumn("bookings", "user_mongo_id"))) {
      await pool.query(`ALTER TABLE bookings ADD COLUMN user_mongo_id VARCHAR(36) NULL`);
      console.log("Added column bookings.user_mongo_id");
    }

    // favorites: ensure user_mongo_id exists
    if (!(await hasColumn("favorites", "user_mongo_id"))) {
      // try adding column; existing schema may have user_id
      await pool.query(`ALTER TABLE favorites ADD COLUMN user_mongo_id VARCHAR(36) NULL`);
      console.log("Added column favorites.user_mongo_id");
    }

    // --- Cleanup legacy foreign keys/columns that reference SQL `users` table ---
    // Some older DBs may still have a `users` table and a foreign key from bookings.user_id -> users.id
    // Our app uses Mongo for users (user_mongo_id), so drop that FK and the legacy column if present.
    const [legacyFks] = await pool.query(
      `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'bookings' AND REFERENCED_TABLE_NAME = 'users'`,
      [dbName]
    );

    if (legacyFks.length) {
      for (const r of legacyFks) {
        const fkName = r.CONSTRAINT_NAME;
        try {
          await pool.query(`ALTER TABLE bookings DROP FOREIGN KEY \`${fkName}\``);
          console.log(`Dropped foreign key bookings.${fkName}`);
        } catch (e) {
          console.warn(`Failed to drop foreign key ${fkName}:`, e.message || e);
        }
      }
    }

    if (await hasColumn('bookings', 'user_id')) {
      try {
        await pool.query(`ALTER TABLE bookings DROP COLUMN user_id`);
        console.log('Dropped column bookings.user_id');
      } catch (e) {
        console.warn('Failed to drop bookings.user_id:', e.message || e);
      }
    }
  } catch (e) {
    console.error("Failed to initialize SQL schema:", e.message || e);
    throw e;
  }
}

module.exports = initSqlSchema;

