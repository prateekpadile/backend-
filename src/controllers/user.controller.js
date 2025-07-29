import { asyncHandler } from '../utils/asyncHandler.js';
import {ApiError} from '../utils/ApiError.js' //1
import {User} from '../models/user.models.js'//2
import {uploadOnCloudinary, uploadOnCloudinary} from '../utils/clodinary.js'//3 
import { ApiResponse } from '../utils/ApiResponse.js';


const registerUser = asyncHandler(async (req, res) => { 
    //get user details from frontend
    const {fullNAme,email,username,password} = req.body
    console.log("email",email);


    //validation - not empty// 1
    if(
        [fullNAme,email,username,password].some((field) =>
        field?.trim() == "") 
    ){
        throw new ApiError(400,"All fields are required")
    }


    //check if user already exits "username,  email"
    User.findOne({
        $or: [{username},{email}]
    })

    if(exitedUser){
        throw new ApiError(409,"User with email or username aready exits ") 
    }

     
    //check for images , and avtar
    const avtarLocalPath =req.files?.avatar[0]?.path;
    const coverLocalPath = req.files?.coverImage[0]?.path;

    if(!avtarLocalPath){
        throw new ApiError(400, " Avatar file is required")
    } 



    //upload them to cloudinary,avtar  //3
    const avatar = await uploadOnCloudinary(avtarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400,"Avatar file is required")
    }



    //create user object - create entry in db
    const user =await User.create({
        fullName,
        email,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        username:username.toLowerCase(),
        password,
    })


    //remove pass and refersh token field from response    
    const createdUser = awaitUser.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500,"Something went wrong while registering the user")
    }

    
    //return res
    return res.status(201).json(
        new ApiResponse(200,createdUser,"User registered succesfully")
    )
    
    
    
    


    
}) 

export { 
    registerUser
}