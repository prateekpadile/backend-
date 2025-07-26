import mongoose, {Schema} from 'mongoose';
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2';

const videoSchema = new Schema({
   videoFile: {
    type: String, //cloudinary video url
    required: true
   },
    thumbnail: {
        type: String, //cloudinary image url
        required: true
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    duration:{
        type: Number,
        required: true 
    },
    views:{
        type: Number,
        default: 0
    },
    isPublished:{
        type: Boolean,
        default: false
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
},{timespans: true});

videoSchema.plugin(mongooseAggregatePaginate);

export const Video = mongoose.mpdel("Video", videoSchema);