("use strict");

const stripe = require("stripe")(process.env.STRIPE_KEY);
/**
 * order controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

// this createCoreController handles our CRUD operation
module.exports = createCoreController("api::order.order", ({ strapi }) => ({
    //here we create a ctx or context
  async create(ctx) {
    const { products } = ctx.request.body;
    try {
        // this line items returns the item name price and other data that will display on on our stripe app
      const lineItems = await Promise.all(//this Promise.all because we have more than one product

        //so this line here map our products from whatever our client products recieved then use our backend to find that product.id
        //which will matched to the product in our client
      products.map(async (product) => {
        // after finding the item we can then use it's price and name
          const item = await strapi
            .service("api::product.product")
            .findOne(product.id);

          return {
            price_data: {
              currency: "usd",
              product_data: {
                name: item.title,
              },
            //   we need to multiply our item.price by 100, because by default stripe gets our price amount
              unit_amount: Math.round(item.price * 100),
            },
            quantity: product.quantity,
          };
        })
      );

      const session = await stripe.checkout.sessions.create({
        shipping_address_collection: {allowed_countries: ['US', 'CA']},
        payment_method_types: ["card"],
        mode: "payment",
        success_url: process.env.CLIENT_URL+"?success=true",
        cancel_url: process.env.CLIENT_URL+"?success=false",
        line_items: lineItems,
      });

        // when everything is ok we can then send our data into our database
      await strapi
        //our .service endpoint now is order 
        .service("api::order.order")
        //and endstead of findOne we now use .create
        .create({ data: {  products, stripeId: session.id } });

        //finally if there is no error we can then return a new property stripeSession with it's data values of our session above
      return { stripeSession: session };
    } catch (error) {
      ctx.response.status = 500;
      return { error };
    }
  },
}));