 import { mongo, Schema } from "mongoose";



 const subscriptionSchema = new Schema({
    subscription: {
        type : Schema.Types.ObjectId, //one who is subscribing
        ref:"User"
    },
    channel: {
        type: Schema.Types.ObjectId, // the channel being subscribed to
        ref : "User"
    }
 },{timestamps:true})

 export const Subscription = mongoose.model("Subscription", subscriptionSchema);