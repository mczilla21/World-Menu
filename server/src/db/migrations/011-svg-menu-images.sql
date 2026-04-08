-- Update menu items to use SVG illustrations (replaces placeholder photos)
-- Only updates items that still have generic food-*.jpg images

UPDATE menu_items SET image = 'build-your-bowl.svg' WHERE name LIKE '%Build Your Noodle Bowl%' AND image LIKE 'food-%';
UPDATE menu_items SET image = 'duck-noodle-soup.svg' WHERE name LIKE '%Duck Noodle%' AND image LIKE 'food-%';
UPDATE menu_items SET image = 'miso-ramen.svg' WHERE name LIKE '%Miso Ramen%' AND name NOT LIKE '%Spicy%' AND image LIKE 'food-%';
UPDATE menu_items SET image = 'spicy-miso-ramen.svg' WHERE name LIKE '%Spicy Miso Ramen%' AND image LIKE 'food-%';
UPDATE menu_items SET image = 'shoyu-ramen.svg' WHERE name LIKE '%Shoyu Ramen%' AND name NOT LIKE '%Spicy%' AND image LIKE 'food-%';
UPDATE menu_items SET image = 'spicy-shoyu-ramen.svg' WHERE name LIKE '%Spicy Shoyu Ramen%' AND image LIKE 'food-%';
UPDATE menu_items SET image = 'tonkotsu-ramen.svg' WHERE name LIKE '%Tonkotsu Ramen%' AND image LIKE 'food-%';
UPDATE menu_items SET image = 'wonton-ramen.svg' WHERE name LIKE '%Wonton Ramen%' AND image LIKE 'food-%';
UPDATE menu_items SET image = 'tom-yum-ramen.svg' WHERE name LIKE '%Tom Yum Ramen%' AND image LIKE 'food-%';
UPDATE menu_items SET image = 'spring-roll.svg' WHERE name LIKE '%Spring Roll%' AND image LIKE 'food-%';
UPDATE menu_items SET image = 'crab-rangoon.svg' WHERE name LIKE '%Crab Rangoon%' AND image LIKE 'food-%';
UPDATE menu_items SET image = 'grilled-meatballs.svg' WHERE name LIKE '%Meatball%' AND image LIKE 'food-%';
UPDATE menu_items SET image = 'gyoza.svg' WHERE name LIKE '%Gyoza%' AND image LIKE 'food-%';
UPDATE menu_items SET image = 'crispy-chicken.svg' WHERE name LIKE '%Crispy Chicken%' AND image LIKE 'food-%';
UPDATE menu_items SET image = 'shrimp-tempura.svg' WHERE name LIKE '%Shrimp Tempura%' AND image LIKE 'food-%';
UPDATE menu_items SET image = 'soda.svg' WHERE name LIKE '%Soda%' AND image LIKE 'food-%';
UPDATE menu_items SET image = 'thai-tea.svg' WHERE name LIKE '%Thai Tea%' AND image LIKE 'food-%';
UPDATE menu_items SET image = 'thai-coffee.svg' WHERE name LIKE '%Thai Coffee%' AND image LIKE 'food-%';
UPDATE menu_items SET image = 'matcha-tea.svg' WHERE name LIKE '%Matcha%' AND image LIKE 'food-%';
