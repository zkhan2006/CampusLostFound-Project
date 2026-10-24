CREATE DATABASE IF NOT EXISTS campus_lost_found
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE campus_lost_found;

CREATE TABLE IF NOT EXISTS items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  report_type ENUM('LOST','FOUND') NOT NULL,
  item_name VARCHAR(120) NOT NULL,
  category ENUM('ID Card','Wallet','Books','Electronics','Keys','Clothing','Bag','Other') NOT NULL DEFAULT 'Other',
  description TEXT NOT NULL,
  location VARCHAR(180) NOT NULL,
  item_date DATE NULL,
  contact_name VARCHAR(100) NOT NULL,
  contact_email VARCHAR(190) NOT NULL,
  contact_phone VARCHAR(30) NULL,
  image_filename VARCHAR(255) NULL,
  status ENUM('OPEN','CLAIMED','RESOLVED') NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_type_status (report_type, status),
  INDEX idx_category (category),
  INDEX idx_created_at (created_at)
);
