const BASE = 'http://localhost:3000/api';
const post = (path, body) => fetch(`${BASE}${path}`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) }).then(r => r.json());
const put = (path, body) => fetch(`${BASE}${path}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) }).then(r => r.json());
const del = (path) => fetch(`${BASE}${path}`, { method: 'DELETE' });

async function main() {
  // Clear existing
  const oldItems = await fetch(`${BASE}/menu`).then(r => r.json());
  for (const item of oldItems) await del(`/menu/${item.id}`);
  const oldCats = await fetch(`${BASE}/categories`).then(r => r.json());
  for (const cat of oldCats) await del(`/categories/${cat.id}`);
  console.log('Cleared old data');

  // Settings
  await put('/settings', { key: 'restaurant_name', value: 'Thai Ladda Noodle Bar' });
  await put('/settings', { key: 'theme_color', value: '#c4942a' });
  await put('/settings', { key: 'order_prefix', value: 'NB' });
  await put('/settings', { key: 'table_count', value: '12' });
  console.log('Settings updated');

  // Categories
  const cats = {};
  for (const [name, sort] of [['Noodles', 1], ['Ramen', 2], ['Appetizers', 3], ['Drinks', 4]]) {
    const res = await post('/categories', { name, sort_order: sort });
    cats[name] = res.id;
    console.log(`  Category: ${name} (id=${res.id})`);
  }

  // === NOODLES ===
  const nb = await post('/menu', {
    category_id: cats['Noodles'], name: 'Build Your Noodle Bowl', price: 9.95,
    description: 'Choose your broth, noodle, and protein. Starting at $9.95.',
    is_popular: 1, prep_time_minutes: 10,
    ingredients: 'bean sprouts, green onion, cilantro'
  });
  console.log(`  Noodle Bowl: id=${nb.id}`);

  await post('/menu', {
    category_id: cats['Noodles'], name: 'Duck Noodles Soup', price: 18.95,
    description: 'Braised special soup with duck meat, bean sprouts, green onion, cilantro.',
    is_special: 1, prep_time_minutes: 15,
    ingredients: 'duck meat, bean sprouts, green onion, cilantro, black sweet soy sauce'
  });

  // === RAMEN ===
  const ramens = [
    ['R1. Miso Ramen', 14.95, 'Japanese Miso broth. Topped with pork chashu, fish cake, mushroom, corn, seaweed, green onion and boiled egg.', 'pork chashu, fish cake, mushroom, corn, seaweed, green onion, boiled egg'],
    ['R2. Spicy Miso Ramen', 14.95, 'Japanese Miso broth with spicy ground chicken, pork or beef. Fish cake, mushroom, corn, seaweed, green onion and boiled egg.', 'spicy ground meat, fish cake, mushroom, corn, seaweed, green onion, boiled egg'],
    ['R3. Shoyu Ramen', 14.95, 'Japanese shoyu broth. Pork chashu, fish cake, sesame oil, bean sprout, seaweed, green onion and boiled egg.', 'pork chashu, fish cake, sesame oil, bean sprouts, seaweed, green onion, boiled egg'],
    ['R4. Spicy Shoyu Ramen', 14.95, 'Japanese shoyu broth with spicy ground chicken, pork or beef. Fish cake, sesame oil, bean sprout, seaweed, green onion and boiled egg.', 'spicy ground meat, fish cake, sesame oil, bean sprouts, seaweed, green onion, boiled egg'],
    ['R5. Tonkotsu Ramen', 14.95, 'Japanese pork bones broth. Pork chashu, fish cake, kikurage (black mushroom), seaweed, green onion and boiled egg.', 'pork chashu, fish cake, kikurage, seaweed, green onion, boiled egg'],
    ['R7. Wonton Ramen', 14.95, 'Chicken base broth with sesame oil. Chicken wonton, bean sprout, broccoli, carrot, napa cabbage, fried garlic, scallion and cilantro.', 'chicken wonton, bean sprouts, broccoli, carrot, napa cabbage, fried garlic, scallion, cilantro'],
    ['R8. Tom Yum Ramen', 14.95, 'Tom yum broth with coconut milk. Ground chicken or pork, iceberg, bean sprout, mushroom, green onion, cilantro and boiled egg. Shrimp +$2.', 'coconut milk, ground meat, iceberg, bean sprouts, mushroom, green onion, cilantro, boiled egg'],
  ];
  for (const [name, price, desc, ingr] of ramens) {
    await post('/menu', { category_id: cats['Ramen'], name, price, description: desc, ingredients: ingr, prep_time_minutes: 12 });
    console.log(`  ${name}`);
  }

  // === APPETIZERS ===
  for (const [name, price, desc] of [
    ['Veg Spring Roll', 6.95, 'Crispy vegetable spring rolls.'],
    ['Crab Rangoon', 6.95, 'Crispy wonton with cream cheese and crab.'],
    ['Grilled Meatballs', 6.95, 'Thai-style grilled meatballs.'],
    ['Gyoza', 6.95, 'Pan-fried Japanese dumplings.'],
    ['Crispy Chicken', 6.95, 'Crispy fried chicken bites.'],
    ['Shrimp Tempura', 6.95, 'Lightly battered fried shrimp.'],
  ]) {
    await post('/menu', { category_id: cats['Appetizers'], name, price, description: desc, prep_time_minutes: 8 });
    console.log(`  ${name}`);
  }

  // === DRINKS ===
  for (const [name, price, desc, popular] of [
    ['Soda', 2.50, 'Fountain soda.', 0],
    ['Thai Tea', 4.95, 'Classic Thai iced tea with cream.', 1],
    ['Thai Coffee', 4.95, 'Strong Thai iced coffee with sweetened cream.', 0],
    ['Matcha Green Tea', 4.95, 'Iced matcha green tea.', 0],
  ]) {
    await post('/menu', { category_id: cats['Drinks'], name, price, description: desc, show_in_kitchen: 0, is_popular: popular });
    console.log(`  ${name}`);
  }

  // === MODIFIER GROUPS ===
  console.log('\nCreating noodle builder...');

  // Step 1: Broth
  const bg = await post('/modifier-groups', { category_id: cats['Noodles'], name: 'Step 1: Choose Broth', required: 1, multi_select: 0, sort_order: 1 });
  for (const [name, p] of [['Thick Soup', 0], ['Clear Soup', 0], ['Tom Yum', 0], ['Yen Ta Four', 0], ['Dry Noodles', 0]]) {
    await post('/modifiers', { group_id: bg.id, name, extra_price: p });
  }
  console.log('  Broth options added');

  // Step 2: Noodle
  const ng = await post('/modifier-groups', { category_id: cats['Noodles'], name: 'Step 2: Choose Noodle', required: 1, multi_select: 0, sort_order: 2 });
  for (const [name, p] of [['Skinny Noodle', 0], ['Thin Noodle', 0], ['Flat Noodle', 0], ['Instant Noodle', 0], ['Glass Noodle (+$2)', 2], ['Egg Noodle (+$2)', 2], ['Shrimp Wonton (+$4)', 4], ['Chicken Wonton (+$3)', 3]]) {
    await post('/modifiers', { group_id: ng.id, name, extra_price: p });
  }
  console.log('  Noodle options added');

  // Step 3: Protein
  const pg = await post('/modifier-groups', { category_id: cats['Noodles'], name: 'Step 3: Choose Protein', required: 1, multi_select: 0, sort_order: 3 });
  for (const [name, p] of [['Tofu', 0], ['Chicken', 0], ['Pork', 0], ['Beef (+$4)', 4], ['Seafood Combo (+$6)', 6]]) {
    await post('/modifiers', { group_id: pg.id, name, extra_price: p });
  }
  console.log('  Protein options added');

  // Spicy Level for Ramen
  const sg = await post('/modifier-groups', { category_id: cats['Ramen'], name: 'Spicy Level', required: 0, multi_select: 0, sort_order: 1 });
  for (const name of ['No Spicy', 'Mild', 'Medium', 'Hot', 'Thai Hot']) {
    await post('/modifiers', { group_id: sg.id, name, extra_price: 0 });
  }
  console.log('  Spicy levels added');

  console.log('\nDone! Thai Ladda Noodle Bar is ready.');
}

main().catch(console.error);
