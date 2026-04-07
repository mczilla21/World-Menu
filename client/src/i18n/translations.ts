// UI translations for all supported languages
// Key = English string, values = translations per language code

const translations: Record<string, Record<string, string>> = {
  // === Role Select ===
  'Select your station': {
    es: 'Selecciona tu estación', zh: '选择你的站点', ja: 'ステーションを選択', ko: '스테이션 선택',
    fr: 'Sélectionnez votre poste', de: 'Wählen Sie Ihre Station', th: 'เลือกสถานีของคุณ',
    vi: 'Chọn trạm của bạn', pt: 'Selecione sua estação', ar: 'اختر محطتك',
    ru: 'Выберите станцию', it: 'Seleziona la tua postazione', hi: 'अपना स्टेशन चुनें',
  },
  'Customer': {
    es: 'Cliente', zh: '顾客', ja: 'お客様', ko: '고객', fr: 'Client', de: 'Kunde', th: 'ลูกค้า',
    vi: 'Khách hàng', pt: 'Cliente', ar: 'العميل', ru: 'Клиент', it: 'Cliente', hi: 'ग्राहक',
  },
  'Browse menu & place orders': {
    es: 'Explorar menú y hacer pedidos', zh: '浏览菜单并下单', ja: 'メニューを見て注文する', ko: '메뉴 탐색 및 주문',
    fr: 'Parcourir le menu et passer commande', de: 'Menü durchsuchen und bestellen', th: 'ดูเมนูและสั่งอาหาร',
    vi: 'Xem thực đơn và đặt món', pt: 'Navegar no menu e fazer pedidos', ar: 'تصفح القائمة وتقديم الطلبات',
    ru: 'Просмотр меню и заказ', it: 'Sfoglia il menu e ordina', hi: 'मेन्यू देखें और ऑर्डर दें',
  },
  'Server': {
    es: 'Mesero', zh: '服务员', ja: 'サーバー', ko: '서버', fr: 'Serveur', de: 'Kellner', th: 'พนักงานเสิร์ฟ',
    vi: 'Phục vụ', pt: 'Garçom', ar: 'النادل', ru: 'Официант', it: 'Cameriere', hi: 'वेटर',
  },
  'Take & manage orders': {
    es: 'Tomar y gestionar pedidos', zh: '接单和管理订单', ja: '注文を取る・管理する', ko: '주문 접수 및 관리',
    fr: 'Prendre et gérer les commandes', de: 'Bestellungen aufnehmen und verwalten', th: 'รับและจัดการออเดอร์',
    vi: 'Nhận và quản lý đơn hàng', pt: 'Receber e gerenciar pedidos', ar: 'استلام وإدارة الطلبات',
    ru: 'Принимать и управлять заказами', it: 'Prendere e gestire gli ordini', hi: 'ऑर्डर लें और प्रबंधित करें',
  },
  'Chef / Kitchen': {
    es: 'Chef / Cocina', zh: '厨师 / 厨房', ja: 'シェフ / キッチン', ko: '셰프 / 주방',
    fr: 'Chef / Cuisine', de: 'Koch / Küche', th: 'เชฟ / ครัว',
    vi: 'Đầu bếp / Bếp', pt: 'Chef / Cozinha', ar: 'الشيف / المطبخ',
    ru: 'Шеф / Кухня', it: 'Chef / Cucina', hi: 'शेफ / किचन',
  },
  'View & complete orders': {
    es: 'Ver y completar pedidos', zh: '查看和完成订单', ja: '注文を確認・完了する', ko: '주문 확인 및 완료',
    fr: 'Voir et compléter les commandes', de: 'Bestellungen anzeigen und abschließen', th: 'ดูและทำออเดอร์ให้เสร็จ',
    vi: 'Xem và hoàn thành đơn hàng', pt: 'Ver e completar pedidos', ar: 'عرض وإكمال الطلبات',
    ru: 'Просмотр и выполнение заказов', it: 'Visualizza e completa gli ordini', hi: 'ऑर्डर देखें और पूरा करें',
  },
  'Admin': {
    es: 'Administrador', zh: '管理员', ja: '管理者', ko: '관리자', fr: 'Admin', de: 'Admin', th: 'ผู้ดูแล',
    vi: 'Quản trị', pt: 'Admin', ar: 'المسؤول', ru: 'Админ', it: 'Admin', hi: 'एडमिन',
  },
  'Manage menu & settings': {
    es: 'Gestionar menú y configuración', zh: '管理菜单和设置', ja: 'メニューと設定を管理', ko: '메뉴 및 설정 관리',
    fr: 'Gérer le menu et les paramètres', de: 'Menü und Einstellungen verwalten', th: 'จัดการเมนูและการตั้งค่า',
    vi: 'Quản lý thực đơn và cài đặt', pt: 'Gerenciar menu e configurações', ar: 'إدارة القائمة والإعدادات',
    ru: 'Управление меню и настройками', it: 'Gestisci menu e impostazioni', hi: 'मेन्यू और सेटिंग्स प्रबंधित करें',
  },

  // === Common buttons ===
  'Back': {
    es: 'Atrás', zh: '返回', ja: '戻る', ko: '뒤로', fr: 'Retour', de: 'Zurück', th: 'กลับ',
    vi: 'Quay lại', pt: 'Voltar', ar: 'رجوع', ru: 'Назад', it: 'Indietro', hi: 'वापस',
  },
  'Next': {
    es: 'Siguiente', zh: '下一步', ja: '次へ', ko: '다음', fr: 'Suivant', de: 'Weiter', th: 'ถัดไป',
    vi: 'Tiếp', pt: 'Próximo', ar: 'التالي', ru: 'Далее', it: 'Avanti', hi: 'अगला',
  },
  'Cancel': {
    es: 'Cancelar', zh: '取消', ja: 'キャンセル', ko: '취소', fr: 'Annuler', de: 'Abbrechen', th: 'ยกเลิก',
    vi: 'Hủy', pt: 'Cancelar', ar: 'إلغاء', ru: 'Отмена', it: 'Annulla', hi: 'रद्द करें',
  },
  'Done': {
    es: 'Listo', zh: '完成', ja: '完了', ko: '완료', fr: 'Terminé', de: 'Fertig', th: 'เสร็จ',
    vi: 'Xong', pt: 'Pronto', ar: 'تم', ru: 'Готово', it: 'Fatto', hi: 'हो गया',
  },
  'Review': {
    es: 'Revisar', zh: '审核', ja: '確認', ko: '검토', fr: 'Vérifier', de: 'Überprüfen', th: 'ตรวจสอบ',
    vi: 'Xem lại', pt: 'Revisar', ar: 'مراجعة', ru: 'Обзор', it: 'Rivedi', hi: 'समीक्षा',
  },
  'Switch': {
    es: 'Cambiar', zh: '切换', ja: '切替', ko: '전환', fr: 'Changer', de: 'Wechseln', th: 'สลับ',
    vi: 'Chuyển', pt: 'Trocar', ar: 'تبديل', ru: 'Сменить', it: 'Cambia', hi: 'बदलें',
  },
  'History': {
    es: 'Historial', zh: '历史', ja: '履歴', ko: '기록', fr: 'Historique', de: 'Verlauf', th: 'ประวัติ',
    vi: 'Lịch sử', pt: 'Histórico', ar: 'السجل', ru: 'История', it: 'Cronologia', hi: 'इतिहास',
  },
  'Tables': {
    es: 'Mesas', zh: '桌号', ja: 'テーブル', ko: '테이블', fr: 'Tables', de: 'Tische', th: 'โต๊ะ',
    vi: 'Bàn', pt: 'Mesas', ar: 'الطاولات', ru: 'Столы', it: 'Tavoli', hi: 'टेबल',
  },

  // === Server Mode ===
  'New Order': {
    es: 'Nuevo pedido', zh: '新订单', ja: '新規注文', ko: '새 주문', fr: 'Nouvelle commande', de: 'Neue Bestellung', th: 'ออเดอร์ใหม่',
    vi: 'Đơn mới', pt: 'Novo pedido', ar: 'طلب جديد', ru: 'Новый заказ', it: 'Nuovo ordine', hi: 'नया ऑर्डर',
  },
  'Select Table': {
    es: 'Seleccionar mesa', zh: '选择桌号', ja: 'テーブルを選択', ko: '테이블 선택', fr: 'Sélectionner une table', de: 'Tisch wählen', th: 'เลือกโต๊ะ',
    vi: 'Chọn bàn', pt: 'Selecionar mesa', ar: 'اختر طاولة', ru: 'Выбрать стол', it: 'Seleziona tavolo', hi: 'टेबल चुनें',
  },
  'Review Order': {
    es: 'Revisar pedido', zh: '审核订单', ja: '注文を確認', ko: '주문 검토', fr: 'Vérifier la commande', de: 'Bestellung prüfen', th: 'ตรวจสอบออเดอร์',
    vi: 'Xem lại đơn', pt: 'Revisar pedido', ar: 'مراجعة الطلب', ru: 'Проверить заказ', it: "Rivedi l'ordine", hi: 'ऑर्डर समीक्षा',
  },
  'Order Sent': {
    es: 'Pedido enviado', zh: '订单已发送', ja: '注文送信済み', ko: '주문 전송됨', fr: 'Commande envoyée', de: 'Bestellung gesendet', th: 'ส่งออเดอร์แล้ว',
    vi: 'Đã gửi đơn', pt: 'Pedido enviado', ar: 'تم إرسال الطلب', ru: 'Заказ отправлен', it: 'Ordine inviato', hi: 'ऑर्डर भेजा गया',
  },
  'Sent to Kitchen!': {
    es: '¡Enviado a cocina!', zh: '已发送到厨房！', ja: 'キッチンに送信しました！', ko: '주방으로 전송!', fr: 'Envoyé en cuisine !', de: 'An die Küche gesendet!', th: 'ส่งไปครัวแล้ว!',
    vi: 'Đã gửi tới bếp!', pt: 'Enviado para a cozinha!', ar: 'تم الإرسال للمطبخ!', ru: 'Отправлено на кухню!', it: 'Inviato in cucina!', hi: 'किचन में भेजा गया!',
  },
  'Table Overview': {
    es: 'Vista de mesas', zh: '桌位概览', ja: 'テーブル概要', ko: '테이블 현황', fr: 'Vue des tables', de: 'Tischübersicht', th: 'ภาพรวมโต๊ะ',
    vi: 'Tổng quan bàn', pt: 'Visão das mesas', ar: 'نظرة عامة على الطاولات', ru: 'Обзор столов', it: 'Panoramica tavoli', hi: 'टेबल अवलोकन',
  },
  'Order History': {
    es: 'Historial de pedidos', zh: '订单历史', ja: '注文履歴', ko: '주문 기록', fr: 'Historique des commandes', de: 'Bestellverlauf', th: 'ประวัติออเดอร์',
    vi: 'Lịch sử đơn', pt: 'Histórico de pedidos', ar: 'سجل الطلبات', ru: 'История заказов', it: 'Storico ordini', hi: 'ऑर्डर इतिहास',
  },
  'Add to Order': {
    es: 'Agregar al pedido', zh: '加入订单', ja: '注文に追加', ko: '주문에 추가', fr: 'Ajouter à la commande', de: 'Zur Bestellung hinzufügen', th: 'เพิ่มในออเดอร์',
    vi: 'Thêm vào đơn', pt: 'Adicionar ao pedido', ar: 'أضف للطلب', ru: 'Добавить к заказу', it: "Aggiungi all'ordine", hi: 'ऑर्डर में जोड़ें',
  },
  'View Current Order': {
    es: 'Ver pedido actual', zh: '查看当前订单', ja: '現在の注文を表示', ko: '현재 주문 보기', fr: 'Voir la commande', de: 'Aktuelle Bestellung anzeigen', th: 'ดูออเดอร์ปัจจุบัน',
    vi: 'Xem đơn hiện tại', pt: 'Ver pedido atual', ar: 'عرض الطلب الحالي', ru: 'Текущий заказ', it: "Vedi l'ordine attuale", hi: 'वर्तमान ऑर्डर देखें',
  },
  'Settle & Clear Table': {
    es: 'Cerrar y limpiar mesa', zh: '结账并清桌', ja: '会計・テーブルクリア', ko: '정산 및 테이블 정리', fr: 'Régler et libérer la table', de: 'Abrechnen und Tisch freigeben', th: 'เคลียร์โต๊ะ',
    vi: 'Thanh toán và dọn bàn', pt: 'Fechar e limpar mesa', ar: 'تسوية وتحرير الطاولة', ru: 'Рассчитать и очистить стол', it: 'Chiudi e libera il tavolo', hi: 'बिल और टेबल साफ करें',
  },
  'Continue Ordering': {
    es: 'Seguir pidiendo', zh: '继续点餐', ja: '注文を続ける', ko: '계속 주문', fr: 'Continuer la commande', de: 'Weiter bestellen', th: 'สั่งต่อ',
    vi: 'Tiếp tục gọi món', pt: 'Continuar pedindo', ar: 'متابعة الطلب', ru: 'Продолжить заказ', it: 'Continua a ordinare', hi: 'ऑर्डर जारी रखें',
  },
  'No items': {
    es: 'Sin artículos', zh: '没有项目', ja: 'アイテムなし', ko: '항목 없음', fr: 'Aucun article', de: 'Keine Artikel', th: 'ไม่มีรายการ',
    vi: 'Không có món', pt: 'Sem itens', ar: 'لا توجد عناصر', ru: 'Нет блюд', it: 'Nessun articolo', hi: 'कोई आइटम नहीं',
  },
  'Guest': {
    es: 'Invitado', zh: '客人', ja: 'ゲスト', ko: '게스트', fr: 'Invité', de: 'Gast', th: 'แขก',
    vi: 'Khách', pt: 'Convidado', ar: 'ضيف', ru: 'Гость', it: 'Ospite', hi: 'अतिथि',
  },
  'Dine In': {
    es: 'Comer aquí', zh: '堂食', ja: '店内飲食', ko: '매장 식사', fr: 'Sur place', de: 'Vor Ort', th: 'ทานที่ร้าน',
    vi: 'Ăn tại chỗ', pt: 'Comer no local', ar: 'تناول الطعام هنا', ru: 'В зале', it: 'Mangiare qui', hi: 'यहां खाएं',
  },
  'Takeout': {
    es: 'Para llevar', zh: '外带', ja: 'テイクアウト', ko: '포장', fr: 'À emporter', de: 'Zum Mitnehmen', th: 'สั่งกลับบ้าน',
    vi: 'Mang về', pt: 'Para viagem', ar: 'طلب خارجي', ru: 'С собой', it: 'Da asporto', hi: 'पैक करें',
  },
  'Pickup': {
    es: 'Recoger', zh: '自取', ja: 'ピックアップ', ko: '픽업', fr: 'À récupérer', de: 'Abholung', th: 'รับเอง',
    vi: 'Nhận tại quầy', pt: 'Retirada', ar: 'استلام', ru: 'Самовывоз', it: 'Ritiro', hi: 'पिकअप',
  },

  // === Kitchen Mode ===
  'Waiting for orders...': {
    es: 'Esperando pedidos...', zh: '等待订单...', ja: '注文を待っています...', ko: '주문 대기 중...', fr: 'En attente de commandes...', de: 'Warte auf Bestellungen...', th: 'กำลังรอออเดอร์...',
    vi: 'Đang chờ đơn...', pt: 'Aguardando pedidos...', ar: 'في انتظار الطلبات...', ru: 'Ожидание заказов...', it: 'In attesa di ordini...', hi: 'ऑर्डर की प्रतीक्षा...',
  },
  'All Stations': {
    es: 'Todas las estaciones', zh: '所有工位', ja: '全ステーション', ko: '전체 스테이션', fr: 'Toutes les stations', de: 'Alle Stationen', th: 'ทุกสถานี',
    vi: 'Tất cả trạm', pt: 'Todas as estações', ar: 'جميع المحطات', ru: 'Все станции', it: 'Tutte le postazioni', hi: 'सभी स्टेशन',
  },
  'Select Your Station': {
    es: 'Selecciona tu estación', zh: '选择你的工位', ja: 'ステーションを選択', ko: '스테이션 선택', fr: 'Sélectionnez votre station', de: 'Wählen Sie Ihre Station', th: 'เลือกสถานีของคุณ',
    vi: 'Chọn trạm của bạn', pt: 'Selecione sua estação', ar: 'اختر محطتك', ru: 'Выберите станцию', it: 'Seleziona la tua postazione', hi: 'अपना स्टेशन चुनें',
  },
  'Mark Preparing': {
    es: 'Marcar preparando', zh: '标记制作中', ja: '調理中にする', ko: '준비 중으로 표시', fr: 'Marquer en préparation', de: 'Als in Zubereitung markieren', th: 'กำลังทำ',
    vi: 'Đánh dấu đang làm', pt: 'Marcar preparando', ar: 'تحديد قيد التحضير', ru: 'Отметить готовится', it: 'Segna in preparazione', hi: 'तैयारी में चिह्नित करें',
  },
  'COMPLETE': {
    es: 'COMPLETAR', zh: '完成', ja: '完了', ko: '완료', fr: 'TERMINÉ', de: 'FERTIG', th: 'เสร็จสิ้น',
    vi: 'HOÀN THÀNH', pt: 'COMPLETO', ar: 'مكتمل', ru: 'ГОТОВО', it: 'COMPLETO', hi: 'पूर्ण',
  },

  // === Customer Mode ===
  'Choose your language': {
    es: 'Elige tu idioma', zh: '选择你的语言', ja: '言語を選択してください', ko: '언어를 선택하세요', fr: 'Choisissez votre langue', de: 'Wählen Sie Ihre Sprache', th: 'เลือกภาษาของคุณ',
    vi: 'Chọn ngôn ngữ', pt: 'Escolha seu idioma', ar: 'اختر لغتك', ru: 'Выберите язык', it: 'Scegli la tua lingua', hi: 'अपनी भाषा चुनें',
  },
  'Search menu...': {
    es: 'Buscar en el menú...', zh: '搜索菜单...', ja: 'メニューを検索...', ko: '메뉴 검색...', fr: 'Rechercher...', de: 'Menü durchsuchen...', th: 'ค้นหาเมนู...',
    vi: 'Tìm món...', pt: 'Pesquisar cardápio...', ar: '...البحث في القائمة', ru: 'Поиск по меню...', it: 'Cerca nel menu...', hi: 'मेन्यू खोजें...',
  },
  'Order Placed!': {
    es: '¡Pedido realizado!', zh: '订单已提交！', ja: '注文完了！', ko: '주문 완료!', fr: 'Commande passée !', de: 'Bestellung aufgegeben!', th: 'สั่งอาหารแล้ว!',
    vi: 'Đã đặt đơn!', pt: 'Pedido feito!', ar: 'تم تقديم الطلب!', ru: 'Заказ принят!', it: 'Ordine effettuato!', hi: 'ऑर्डर दिया गया!',
  },
  'Order More': {
    es: 'Pedir más', zh: '再点', ja: 'もっと注文', ko: '더 주문', fr: 'Commander plus', de: 'Mehr bestellen', th: 'สั่งเพิ่ม',
    vi: 'Gọi thêm', pt: 'Pedir mais', ar: 'اطلب المزيد', ru: 'Заказать ещё', it: 'Ordina ancora', hi: 'और ऑर्डर करें',
  },
  'View Cart': {
    es: 'Ver carrito', zh: '查看购物车', ja: 'カートを見る', ko: '장바구니 보기', fr: 'Voir le panier', de: 'Warenkorb anzeigen', th: 'ดูตะกร้า',
    vi: 'Xem giỏ hàng', pt: 'Ver carrinho', ar: 'عرض السلة', ru: 'Корзина', it: 'Vedi carrello', hi: 'कार्ट देखें',
  },
  'Request Check': {
    es: 'Pedir la cuenta', zh: '请求买单', ja: 'お会計', ko: '계산서 요청', fr: "Demander l'addition", de: 'Rechnung bitte', th: 'เช็คบิล',
    vi: 'Gọi tính tiền', pt: 'Pedir a conta', ar: 'طلب الفاتورة', ru: 'Попросить счёт', it: 'Chiedi il conto', hi: 'बिल मांगें',
  },
  'Call Waiter': {
    es: 'Llamar mesero', zh: '呼叫服务员', ja: 'ウェイターを呼ぶ', ko: '직원 호출', fr: 'Appeler le serveur', de: 'Kellner rufen', th: 'เรียกพนักงาน',
    vi: 'Gọi phục vụ', pt: 'Chamar garçom', ar: 'استدعاء النادل', ru: 'Позвать официанта', it: 'Chiama cameriere', hi: 'वेटर को बुलाएं',
  },

  // === Admin ===
  'Admin Panel': {
    es: 'Panel de administración', zh: '管理面板', ja: '管理パネル', ko: '관리 패널', fr: "Panneau d'admin", de: 'Adminbereich', th: 'แผงควบคุม',
    vi: 'Bảng quản trị', pt: 'Painel admin', ar: 'لوحة الإدارة', ru: 'Панель управления', it: 'Pannello admin', hi: 'एडमिन पैनल',
  },
  'Categories': {
    es: 'Categorías', zh: '分类', ja: 'カテゴリ', ko: '카테고리', fr: 'Catégories', de: 'Kategorien', th: 'หมวดหมู่',
    vi: 'Danh mục', pt: 'Categorias', ar: 'الفئات', ru: 'Категории', it: 'Categorie', hi: 'श्रेणियां',
  },
  'Menu Items': {
    es: 'Artículos del menú', zh: '菜单项目', ja: 'メニュー項目', ko: '메뉴 항목', fr: 'Articles du menu', de: 'Menüeinträge', th: 'รายการเมนู',
    vi: 'Món ăn', pt: 'Itens do cardápio', ar: 'عناصر القائمة', ru: 'Пункты меню', it: 'Articoli del menu', hi: 'मेन्यू आइटम',
  },
  'Settings': {
    es: 'Configuración', zh: '设置', ja: '設定', ko: '설정', fr: 'Paramètres', de: 'Einstellungen', th: 'การตั้งค่า',
    vi: 'Cài đặt', pt: 'Configurações', ar: 'الإعدادات', ru: 'Настройки', it: 'Impostazioni', hi: 'सेटिंग्स',
  },
  'Reports': {
    es: 'Informes', zh: '报表', ja: 'レポート', ko: '보고서', fr: 'Rapports', de: 'Berichte', th: 'รายงาน',
    vi: 'Báo cáo', pt: 'Relatórios', ar: 'التقارير', ru: 'Отчёты', it: 'Report', hi: 'रिपोर्ट',
  },
  'Translations': {
    es: 'Traducciones', zh: '翻译', ja: '翻訳', ko: '번역', fr: 'Traductions', de: 'Übersetzungen', th: 'การแปล',
    vi: 'Bản dịch', pt: 'Traduções', ar: 'الترجمات', ru: 'Переводы', it: 'Traduzioni', hi: 'अनुवाद',
  },
  'Item Builder': {
    es: 'Constructor de artículos', zh: '项目构建器', ja: 'アイテムビルダー', ko: '아이템 빌더', fr: "Constructeur d'articles", de: 'Artikelkonfigurator', th: 'ตัวสร้างรายการ',
    vi: 'Tùy chỉnh món', pt: 'Construtor de itens', ar: 'منشئ العناصر', ru: 'Конструктор блюд', it: 'Configuratore articoli', hi: 'आइटम बिल्डर',
  },
  'Combos': {
    es: 'Combos', zh: '套餐', ja: 'セット', ko: '세트', fr: 'Combos', de: 'Combos', th: 'เซ็ต',
    vi: 'Combo', pt: 'Combos', ar: 'كومبو', ru: 'Комбо', it: 'Combo', hi: 'कॉम्बो',
  },
  'Print Receipt': {
    es: 'Imprimir recibo', zh: '打印收据', ja: 'レシート印刷', ko: '영수증 인쇄', fr: 'Imprimer le reçu', de: 'Beleg drucken', th: 'พิมพ์ใบเสร็จ',
    vi: 'In hóa đơn', pt: 'Imprimir recibo', ar: 'طباعة الإيصال', ru: 'Печать чека', it: 'Stampa ricevuta', hi: 'रसीद प्रिंट करें',
  },
  'Table': {
    es: 'Mesa', zh: '桌', ja: 'テーブル', ko: '테이블', fr: 'Table', de: 'Tisch', th: 'โต๊ะ',
    vi: 'Bàn', pt: 'Mesa', ar: 'طاولة', ru: 'Стол', it: 'Tavolo', hi: 'टेबल',
  },
};

export default translations;
