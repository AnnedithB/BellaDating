-- Create first admin account
-- Email: ogollachucho@gmail.com
-- Password: 123456789

INSERT INTO admins (
  id, 
  email, 
  "passwordHash", 
  "firstName", 
  "lastName", 
  role, 
  "isActive", 
  "createdAt", 
  "updatedAt"
) VALUES (
  'admin001',
  'ogollachucho@gmail.com',
  '$2a$10$j/FGWc.strcp0dECam8f7O5XlMBb5w9rsnLTPoAzcy/VQXDKHnYji',
  'Super',
  'Admin',
  'SUPER_ADMIN',
  true,
  NOW(),
  NOW()
);
