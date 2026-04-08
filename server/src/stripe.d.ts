declare module 'stripe' {
  class Stripe {
    constructor(apiKey: string);
    paymentIntents: {
      create(params: {
        amount: number;
        currency: string;
        metadata?: Record<string, string>;
      }): Promise<{ client_secret: string }>;
    };
  }
  export default Stripe;
}
