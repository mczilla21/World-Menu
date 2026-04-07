interface Props {
  tableNumber: string;
  onAddMore: () => void;
  restaurantName: string;
  orderType: string;
}

export default function OrderConfirmation({ tableNumber, onAddMore, restaurantName, orderType }: Props) {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8">
      <div className="bg-green-100 w-24 h-24 rounded-full flex items-center justify-center mb-6">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Placed!</h2>
      <p className="text-gray-500 mb-1">
        {orderType === 'dine_in' ? `Table ${tableNumber}` : orderType === 'takeout' ? 'Takeout' : 'Pickup'}
      </p>
      <p className="text-gray-400 text-sm mb-8">Your order has been sent to the kitchen at {restaurantName}</p>

      <button
        onClick={onAddMore}
        className="px-8 py-4 rounded-2xl font-semibold text-lg transition-all active:scale-[0.98] w-full max-w-xs"
        style={{ background: '#3b82f6', color: '#ffffff' }}
      >
        Order More
      </button>
    </div>
  );
}
