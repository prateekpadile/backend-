import { asyncHandler } from '../utils/asyncHandler.js';
import {ApiError} from '../utils/ApiError.js' //1
import {User} from '../models/user.model.js'//2
import {uploadOnCloudinary} from '../utils/cloudinary.js'//3 
import { ApiResponse } from '../utils/ApiResponse.js';
import jwt from 'jsonwebtoken'; //5


const generateAccessAndRefreshTokens = async(userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = await user.generateAccessToken();
        const refreshToken = await user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });
 // Save without validation to avoid circular dependency issues

        return {accessToken, refreshToken};
         

    } catch (error) {
        throw new ApiError(500, "something went wrong while generating referesh and access tokens");
    }
}


const registerUser = asyncHandler(async (req, res) => { 
    //get user details from frontend
    const {fullName,email,username,password} = req.body
    console.log("email",email);


    //validation - not empty// 1
    if(
        [fullName,email,username,password].some((field) =>
        field?.trim() == "") 
    ){
        throw new ApiError(400,"All fields are required")
    }


    //check if user already exits "username,  email"
    const existedUser = await  User.findOne({
        $or: [{username},{email}]
    })

    if(existedUser){
        throw new ApiError(409,"User with email or username aready exits ") 
    }

     
    //check for images , and avtar
    const avatarLocalPath =req?.files?.avatar?.[0]?.path;
    const coverImageLocalPath = req?.files?.coverImage?.[0]?.path;

    if(!avatarLocalPath){
        throw new ApiError(400, " Avatar file is required")
    } 



    //upload them to cloudinary,avtar  //3
    const avatar = await uploadOnCloudinary(avatarLocalPath)
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
    const createdUser = await User.findById(user._id).select(
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

const loginUser = asyncHandler(async(req,res) => {
    //req body  -> data
    
    const {email,username,password} = req.body


    //username or login
    if(!(email || username)){
        throw new ApiError(400,"Email or username is required")
    }   


    //find user by username or email
    const user = await User.findOne({
        $or:[{username}, {email}]  
    })

    if(!user){
        throw new ApiError(404,"User does not exist");
    }


    //password check
    const isPasswordValid = await user.isPasswordCorrect (password)

    if(!isPasswordValid){
        throw new ApiError(401,"Invalid password")
    }
    

    //generate access token and refresh token
    const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(user._id)


    //send cookies
    const loggedInUser = await User.findById(user._id).
    select("-password -refreshToken");

    const options ={
        httpOnly: true,
        secure: true,
    }

    return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            { 
                loggedInUser,accessToken,refreshToken
            }, "User logged in successfully")
    )
})

const logoutUser = asyncHandler(async(req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1 // this removes the field from document
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"))

})

const refreshAccessToken = asyncHandler(async(req,res) =>{ //5
    const incomingRefreshToken =req.cookies.refreshToken || req.body.refreshToken;
    if(!incomingRefreshToken){
        throw new ApiError(401, "Refresh token is required")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken._id)
        if(!user){
            throw new ApiError(401, "Refresh token is required")
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "Refresh token is required")
        }
    
        const options ={
            httpOnly: true,
            secure: true
        }
    
        const {accessToken,newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
        return res
        .status(200)
        .cookie("accessToken", accessToken,options)
        .cookie("refreshToken", newRefreshToken, options)
        .json ( 
            new ApiResponse(
            200,
            {accessToken,refreshToken: newRefreshToken},
            "Access token refreshed successfully"
            )
        )
    
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }
})


export { 
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken
}