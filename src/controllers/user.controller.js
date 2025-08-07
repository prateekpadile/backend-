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

const changeCurrentPassword = asyncHandler(async(req, res) => {
    const {oldPassword , newPassword} = req.body

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
    
    if(!isPasswordCorrect){
        throw new ApiError(400,"Invalid old password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false}) // Save without validation to avoid circular dependency issues

    return res.status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"))
})

const getCurrentUser = asyncHandler(async(req, res) => {
    return res.status(200)
    .json(new ApiResponse(200,req.user, "Current user fetched successfully"))
})

const updateAccountDetails = asyncHandler(async(req,res) => {
    const {fullName , email} = req.body

    if(!fullName || !email){
        throw new ApiError(400,"All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullName,
                email
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200,"Account details  updates successfully"))

})

const updateUserAvatar = asyncHandler(async(req,res)=>{
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is missing")
    }

    const avatar  = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400,"error while uploading on avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar:avatar.url
            } 
        },
        {new:true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200,user,"avatar img updated succesfully ")
        
    )
})

const updateUserCoverImg = asyncHandler(async(req,res)=>{
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400,"cover image  file is missing")
    }

    const coverImage  = await uploadOnCloudinary(coverImageLocalPath )

    if(!coverImage.url){
        throw new ApiError(400,"error while uploading on avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: .url
            } 
        },
        {new:true}
    ).select("-password")


    return res
    .status(200)
    .json(
        new ApiResponse(200,user,"cover img updated succesfully ")

    )
})

const getUserChannelProfile = asyncHandler(async(req,res) => {
    const{username} = req.params

    if(!username){
        throw new ApiError(400, "Username is required")
    }
    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField:"_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField:"_id",
                foreignField: "subscriber",
                as: "subscribeTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelSubscribedToCount:{
                    $size: "$subscribeTo"
                },
                isSubscribed: {
                    $cond:{
                        if: {$in: [req.user?._id, "$subscribes.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ])

    if (!channel?.length) {
        throw new ApiError(404, "channel does not exists")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
    )
}) 

const getWatchHistory = asyncHandler(async(req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "Watch history fetched successfully"
        )
    )
})



export { 
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImg,
    getUserChannelProfile,
    getWatchHistory
}