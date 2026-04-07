// Seed script: Thai Ladda Restaurant menu
const BASE = 'http://localhost:3000/api';

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function put(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function main() {
  console.log('Setting up Thai Ladda restaurant...');

  // Update settings
  await put('/settings', { key: 'restaurant_name', value: 'Thai Ladda' });
  await put('/settings', { key: 'currency_symbol', value: '$' });
  await put('/settings', { key: 'order_prefix', value: 'TL' });
  await put('/settings', { key: 'theme_color', value: '#d97706' });
  await put('/settings', { key: 'table_count', value: '15' });
  await put('/settings', { key: 'order_types_enabled', value: 'dine_in,takeout,pickup' });
  await put('/settings', { key: 'tipping_enabled', value: '1' });
  await put('/settings', { key: 'tip_percentages', value: '15,18,20,25' });
  await put('/settings', { key: 'call_waiter_enabled', value: '1' });
  console.log('Settings updated.');

  // Create categories
  const categories = [
    'Appetizers',
    'Soups',
    'Salads',
    'Fried Rice',
    'Noodles',
    'Curry',
    'Stir Fry',
    "Chef's Specials",
    'Sides',
    'Drinks',
    'Desserts',
  ];

  const catIds = {};
  for (const name of categories) {
    const res = await post('/categories', { name });
    catIds[name] = res.id;
    console.log(`  Category: ${name} (id=${res.id})`);
  }

  // Helper to create items
  async function addItem(category, item) {
    const body = {
      category_id: catIds[category],
      name: item.name,
      description: item.description || '',
      price: item.price,
      tags: item.tags || '',
      show_in_kitchen: item.show_in_kitchen !== undefined ? item.show_in_kitchen : 1,
      is_popular: item.is_popular || 0,
      is_special: item.is_special || 0,
      special_price: item.special_price || null,
      prep_time_minutes: item.prep_time || 0,
      serves: item.serves || '',
      is_alcohol: item.is_alcohol || 0,
    };
    const res = await post('/menu', body);
    console.log(`    Item: ${item.name} ($${item.price}) id=${res.id}`);
    return res.id;
  }

  // ========== APPETIZERS ==========
  await addItem('Appetizers', {
    name: 'Thai Spring Rolls',
    description: 'Crispy rolls stuffed with glass noodles, vegetables, and ground pork. Served with sweet chili sauce.',
    price: 7.95,
    tags: '',
    is_popular: 1,
    prep_time: 10,
  });
  await addItem('Appetizers', {
    name: 'Fresh Summer Rolls',
    description: 'Rice paper wrapped with shrimp, lettuce, mint, basil, and vermicelli. Served with peanut sauce.',
    price: 8.95,
    tags: 'gluten_free',
    prep_time: 8,
  });
  await addItem('Appetizers', {
    name: 'Chicken Satay',
    description: 'Grilled marinated chicken skewers served with peanut sauce and cucumber relish.',
    price: 9.95,
    tags: 'gluten_free',
    is_popular: 1,
    prep_time: 12,
  });
  await addItem('Appetizers', {
    name: 'Thai Dumplings',
    description: 'Steamed dumplings filled with shrimp, chicken, and water chestnuts. Topped with crispy garlic.',
    price: 8.95,
    tags: '',
    prep_time: 12,
  });
  await addItem('Appetizers', {
    name: 'Crab Rangoon',
    description: 'Crispy wonton skins filled with cream cheese and crab meat. Served with sweet plum sauce.',
    price: 7.95,
    tags: '',
    prep_time: 8,
  });
  await addItem('Appetizers', {
    name: 'Thai Calamari',
    description: 'Lightly battered and fried squid with Thai spices. Served with sweet chili sauce.',
    price: 9.95,
    tags: '',
    prep_time: 10,
  });
  await addItem('Appetizers', {
    name: 'Edamame',
    description: 'Steamed soybeans sprinkled with sea salt.',
    price: 5.95,
    tags: 'vegetarian,vegan,gluten_free',
    prep_time: 5,
  });

  // ========== SOUPS ==========
  await addItem('Soups', {
    name: 'Tom Yum',
    description: 'Classic Thai hot and sour soup with lemongrass, galangal, kaffir lime leaves, mushrooms, and chili.',
    price: 5.95,
    tags: 'gluten_free,spicy',
    is_popular: 1,
    prep_time: 10,
  });
  await addItem('Soups', {
    name: 'Tom Kha',
    description: 'Coconut milk soup with galangal, lemongrass, mushrooms, and Thai herbs.',
    price: 5.95,
    tags: 'gluten_free',
    prep_time: 10,
  });
  await addItem('Soups', {
    name: 'Wonton Soup',
    description: 'Clear broth with pork and shrimp wontons, bok choy, and scallions.',
    price: 5.95,
    tags: '',
    prep_time: 8,
  });

  // ========== SALADS ==========
  await addItem('Salads', {
    name: 'Papaya Salad (Som Tum)',
    description: 'Shredded green papaya with tomatoes, green beans, peanuts, and chili lime dressing.',
    price: 10.95,
    tags: 'gluten_free,spicy',
    is_popular: 1,
    prep_time: 8,
  });
  await addItem('Salads', {
    name: 'Larb (Thai Meat Salad)',
    description: 'Minced chicken or pork with red onion, scallions, mint, cilantro, and toasted rice in lime dressing.',
    price: 12.95,
    tags: 'gluten_free,spicy',
    prep_time: 10,
  });
  await addItem('Salads', {
    name: 'Yum Nua (Beef Salad)',
    description: 'Grilled beef sliced thin with red onion, tomato, cucumber, and spicy lime dressing.',
    price: 13.95,
    tags: 'gluten_free,spicy',
    prep_time: 12,
  });

  // ========== FRIED RICE ==========
  await addItem('Fried Rice', {
    name: 'Thai Fried Rice',
    description: 'Stir-fried jasmine rice with egg, onion, tomato, and scallions. Choice of protein.',
    price: 13.95,
    tags: 'gluten_free',
    is_popular: 1,
    prep_time: 12,
  });
  await addItem('Fried Rice', {
    name: 'Basil Fried Rice',
    description: 'Fried rice with Thai basil, chili, bell peppers, onion, and egg.',
    price: 14.95,
    tags: 'spicy',
    prep_time: 12,
  });
  await addItem('Fried Rice', {
    name: 'Pineapple Fried Rice',
    description: 'Fried rice with pineapple, cashew nuts, raisins, curry powder, and egg.',
    price: 14.95,
    tags: '',
    prep_time: 12,
  });
  await addItem('Fried Rice', {
    name: 'Crab Fried Rice',
    description: 'Fried rice with crab meat, egg, onion, and scallions.',
    price: 16.95,
    tags: '',
    is_special: 1,
    special_price: 14.95,
    prep_time: 12,
  });

  // ========== NOODLES ==========
  await addItem('Noodles', {
    name: 'Pad Thai',
    description: 'Stir-fried rice noodles with egg, bean sprouts, scallions, and crushed peanuts in tamarind sauce.',
    price: 13.95,
    tags: 'gluten_free',
    is_popular: 1,
    prep_time: 12,
  });
  await addItem('Noodles', {
    name: 'Pad See Ew',
    description: 'Wide rice noodles stir-fried with egg, Chinese broccoli in sweet soy sauce.',
    price: 13.95,
    tags: '',
    is_popular: 1,
    prep_time: 12,
  });
  await addItem('Noodles', {
    name: 'Drunken Noodles (Pad Kee Mao)',
    description: 'Wide noodles stir-fried with Thai basil, chili, bell peppers, tomato, and egg.',
    price: 14.95,
    tags: 'spicy',
    is_popular: 1,
    prep_time: 12,
  });
  await addItem('Noodles', {
    name: 'Pad Woon Sen',
    description: 'Glass noodles stir-fried with egg, vegetables, and light soy sauce.',
    price: 13.95,
    tags: '',
    prep_time: 10,
  });
  await addItem('Noodles', {
    name: 'Boat Noodle Soup',
    description: 'Rice noodles in rich aromatic beef broth with braised beef, bean sprouts, and Thai herbs.',
    price: 14.95,
    tags: 'spicy',
    prep_time: 10,
  });

  // ========== CURRY ==========
  await addItem('Curry', {
    name: 'Green Curry',
    description: 'Thai green curry with coconut milk, bamboo shoots, Thai basil, bell peppers, and eggplant.',
    price: 14.95,
    tags: 'gluten_free,spicy',
    is_popular: 1,
    prep_time: 15,
  });
  await addItem('Curry', {
    name: 'Red Curry',
    description: 'Thai red curry with coconut milk, bamboo shoots, bell peppers, and Thai basil.',
    price: 14.95,
    tags: 'gluten_free,spicy',
    prep_time: 15,
  });
  await addItem('Curry', {
    name: 'Yellow Curry',
    description: 'Mild yellow curry with coconut milk, potatoes, onions, and carrots.',
    price: 14.95,
    tags: 'gluten_free',
    prep_time: 15,
  });
  await addItem('Curry', {
    name: 'Massaman Curry',
    description: 'Rich curry with coconut milk, potatoes, onions, peanuts, and warm spices.',
    price: 15.95,
    tags: 'gluten_free',
    is_popular: 1,
    prep_time: 18,
  });
  await addItem('Curry', {
    name: 'Panang Curry',
    description: 'Thick red curry with coconut milk, kaffir lime leaves, bell peppers, and ground peanuts.',
    price: 15.95,
    tags: 'gluten_free,spicy',
    prep_time: 15,
  });
  await addItem('Curry', {
    name: 'Pineapple Curry',
    description: 'Red curry with pineapple, coconut milk, tomato, and Thai basil.',
    price: 15.95,
    tags: 'gluten_free',
    prep_time: 15,
  });

  // ========== STIR FRY ==========
  await addItem('Stir Fry', {
    name: 'Pad Kra Pao (Thai Basil Stir Fry)',
    description: 'Stir-fried with Thai holy basil, chili, garlic, bell peppers, and green beans.',
    price: 14.95,
    tags: 'spicy',
    is_popular: 1,
    prep_time: 10,
  });
  await addItem('Stir Fry', {
    name: 'Cashew Nut Stir Fry',
    description: 'Stir-fried with roasted cashews, onion, bell peppers, water chestnuts, and dried chili.',
    price: 14.95,
    tags: '',
    prep_time: 10,
  });
  await addItem('Stir Fry', {
    name: 'Ginger Stir Fry',
    description: 'Stir-fried with fresh ginger, mushrooms, onion, bell peppers, and scallions.',
    price: 13.95,
    tags: '',
    prep_time: 10,
  });
  await addItem('Stir Fry', {
    name: 'Garlic & Pepper',
    description: 'Stir-fried with fresh garlic, black pepper, and steamed vegetables.',
    price: 13.95,
    tags: 'gluten_free',
    prep_time: 10,
  });
  await addItem('Stir Fry', {
    name: 'Sweet & Sour',
    description: 'Stir-fried with pineapple, tomato, cucumber, onion, and bell peppers in sweet & sour sauce.',
    price: 13.95,
    tags: '',
    prep_time: 10,
  });
  await addItem('Stir Fry', {
    name: 'Mixed Vegetables',
    description: 'Stir-fried seasonal vegetables in garlic sauce.',
    price: 12.95,
    tags: 'vegetarian,vegan,gluten_free',
    prep_time: 8,
  });

  // ========== CHEF'S SPECIALS ==========
  await addItem("Chef's Specials", {
    name: 'Crispy Duck',
    description: 'Half crispy duck served with steamed vegetables and choice of curry sauce or tamarind sauce.',
    price: 24.95,
    tags: '',
    is_popular: 1,
    is_special: 1,
    prep_time: 25,
    serves: '1-2',
  });
  await addItem("Chef's Specials", {
    name: 'Crying Tiger',
    description: 'Grilled marinated ribeye steak sliced and served with spicy Isaan dipping sauce and sticky rice.',
    price: 22.95,
    tags: 'gluten_free,spicy',
    is_special: 1,
    prep_time: 20,
  });
  await addItem("Chef's Specials", {
    name: 'Pla Rad Prik (Crispy Fish)',
    description: 'Whole fried red snapper topped with spicy chili garlic sauce.',
    price: 21.95,
    tags: 'spicy',
    is_special: 1,
    prep_time: 25,
    serves: '1-2',
  });
  await addItem("Chef's Specials", {
    name: 'Thai BBQ Ribs',
    description: 'Slow-cooked pork ribs glazed with Thai BBQ sauce. Served with sticky rice and papaya salad.',
    price: 19.95,
    tags: '',
    is_special: 1,
    prep_time: 20,
    serves: '1-2',
  });
  await addItem("Chef's Specials", {
    name: 'Seafood Delight',
    description: 'Shrimp, scallops, squid, and mussels stir-fried with Thai basil, chili, and garlic.',
    price: 22.95,
    tags: 'spicy',
    is_special: 1,
    prep_time: 18,
    serves: '1-2',
  });
  await addItem("Chef's Specials", {
    name: 'Khao Soi (Northern Thai Curry Noodles)',
    description: 'Egg noodles in rich coconut curry broth with crispy noodle topping, pickled mustard, and shallots.',
    price: 16.95,
    tags: 'spicy',
    is_popular: 1,
    prep_time: 15,
  });

  // ========== SIDES ==========
  await addItem('Sides', {
    name: 'Jasmine Rice',
    description: 'Steamed Thai jasmine rice.',
    price: 2.50,
    tags: 'vegetarian,vegan,gluten_free',
    show_in_kitchen: 0,
    prep_time: 0,
  });
  await addItem('Sides', {
    name: 'Sticky Rice',
    description: 'Traditional Thai sticky rice.',
    price: 3.00,
    tags: 'vegetarian,vegan,gluten_free',
    show_in_kitchen: 0,
    prep_time: 0,
  });
  await addItem('Sides', {
    name: 'Brown Rice',
    description: 'Steamed brown rice.',
    price: 3.00,
    tags: 'vegetarian,vegan,gluten_free',
    show_in_kitchen: 0,
    prep_time: 0,
  });
  await addItem('Sides', {
    name: 'Coconut Rice',
    description: 'Jasmine rice cooked in coconut milk.',
    price: 3.50,
    tags: 'vegetarian,gluten_free',
    show_in_kitchen: 0,
    prep_time: 0,
  });
  await addItem('Sides', {
    name: 'Extra Peanut Sauce',
    description: 'Side of house-made peanut sauce.',
    price: 1.50,
    tags: 'vegetarian,gluten_free',
    show_in_kitchen: 0,
    prep_time: 0,
  });

  // ========== DRINKS ==========
  await addItem('Drinks', {
    name: 'Thai Iced Tea',
    description: 'Classic Thai tea with cream over ice.',
    price: 4.50,
    tags: 'vegetarian',
    is_popular: 1,
    show_in_kitchen: 0,
    prep_time: 0,
  });
  await addItem('Drinks', {
    name: 'Thai Iced Coffee',
    description: 'Strong Thai coffee with sweetened cream over ice.',
    price: 4.50,
    tags: 'vegetarian',
    show_in_kitchen: 0,
    prep_time: 0,
  });
  await addItem('Drinks', {
    name: 'Coconut Juice',
    description: 'Fresh young coconut juice.',
    price: 4.95,
    tags: 'vegetarian,vegan,gluten_free',
    show_in_kitchen: 0,
    prep_time: 0,
  });
  await addItem('Drinks', {
    name: 'Lemongrass Tea',
    description: 'Hot or iced lemongrass herbal tea.',
    price: 3.50,
    tags: 'vegetarian,vegan,gluten_free',
    show_in_kitchen: 0,
    prep_time: 0,
  });
  await addItem('Drinks', {
    name: 'Singha Beer',
    description: 'Premium Thai lager beer.',
    price: 5.95,
    tags: '',
    is_alcohol: 1,
    show_in_kitchen: 0,
    prep_time: 0,
  });
  await addItem('Drinks', {
    name: 'Chang Beer',
    description: 'Classic Thai beer.',
    price: 5.50,
    tags: '',
    is_alcohol: 1,
    show_in_kitchen: 0,
    prep_time: 0,
  });
  await addItem('Drinks', {
    name: 'Sake (Hot or Cold)',
    description: 'Japanese rice wine served hot or cold.',
    price: 7.95,
    tags: '',
    is_alcohol: 1,
    show_in_kitchen: 0,
    prep_time: 0,
  });

  // ========== DESSERTS ==========
  await addItem('Desserts', {
    name: 'Mango Sticky Rice',
    description: 'Sweet sticky rice with fresh mango and coconut cream.',
    price: 8.95,
    tags: 'vegetarian,gluten_free',
    is_popular: 1,
    prep_time: 5,
  });
  await addItem('Desserts', {
    name: 'Thai Coconut Ice Cream',
    description: 'Coconut ice cream with peanuts, corn, and drizzled with coconut cream.',
    price: 6.95,
    tags: 'vegetarian,gluten_free',
    prep_time: 3,
  });
  await addItem('Desserts', {
    name: 'Fried Banana',
    description: 'Banana in crispy batter, served with honey and sesame seeds.',
    price: 6.95,
    tags: 'vegetarian',
    prep_time: 8,
  });
  await addItem('Desserts', {
    name: 'Thai Tea Cheesecake',
    description: 'Creamy cheesecake infused with Thai tea flavor.',
    price: 7.95,
    tags: 'vegetarian',
    is_special: 1,
    prep_time: 0,
  });

  console.log('\nDone! Thai Ladda menu seeded successfully.');
  console.log('Open http://localhost:3000 to test.');
}

main().catch(console.error);
