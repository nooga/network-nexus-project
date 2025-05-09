import React from 'react';
import Header from "@/components/Header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Briefcase, Edit, ExternalLink, Link2, MapPin, MoreHorizontal, PenSquare, Plus, User } from "lucide-react";
import PostCard from "@/components/PostCard";
import { useAuth0 } from '@auth0/auth0-react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { fetchCurrentUser, fetchUserByUsername, fetchUserPosts, fetchConnections, fetchUserConnections } from '@/lib/api';

// Profile page data fetched from API
interface UserProfile {
  _id: string;
  sub?: string;
  username: string;
  name: string;
  title?: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
}

// Data shapes for this page
interface ConnectionUser {
  _id: string;
  username: string;
  name: string;
  title?: string;
  avatarUrl?: string;
}

interface UserPost {
  _id: string;
  id: string;
  author: {
    _id: string;
    username: string;
    name: string;
    title?: string;
    avatarUrl?: string;
    profileUrl: string;
  };
  content: string;
  imageUrl?: string;
  timestamp: string;
  likes: number;
  comments: number;
  isLiked?: boolean;
}

export default function Profile() {
  const { username } = useParams<{ username: string }>();
  const { user: authUser, getAccessTokenSilently, isAuthenticated, isLoading: authLoading } = useAuth0();

  const { data: profileUser, isLoading: userLoading, error: userError } = useQuery<UserProfile, Error>({
    queryKey: username ? ['userProfileByUsername', username] : ['currentUserProfile'],
    queryFn: async () => {
      const token = await getAccessTokenSilently();
      if (username) {
        return fetchUserByUsername(token, username);
      } else {
        return fetchCurrentUser(token);
      }
    },
    enabled: isAuthenticated,
    retry: 1,
  });

  const isCurrentUserProfile = !username || (profileUser && profileUser.sub === authUser?.sub);
  const targetUserId = profileUser?._id;

  const { data: connections = [], isLoading: connLoading } = useQuery<ConnectionUser[], Error>({
    queryKey: ['userConnections', targetUserId],
    queryFn: async () => {
      if (!targetUserId) throw new Error("Target User ID not available for connections fetch");
      const token = await getAccessTokenSilently();
      return fetchUserConnections(token, targetUserId);
    },
    enabled: isAuthenticated && !!targetUserId,
  });

  const { data: posts = [], isLoading: postsLoading } = useQuery<UserPost[], Error>({
    queryKey: ['userPosts', targetUserId],
    queryFn: async () => {
      if (!targetUserId) throw new Error("Target User ID not available for posts fetch");
      const token = await getAccessTokenSilently();
      return fetchUserPosts(token, targetUserId);
    },
    enabled: isAuthenticated && !!targetUserId,
  });

  const isLoading = authLoading || userLoading || (!!targetUserId && (connLoading || postsLoading));

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading profile…</div>;
  }

  if (userError) {
    return <div className="flex items-center justify-center h-screen">Error loading profile: {userError.message}</div>;
  }

  if (!profileUser) {
    return <div className="flex items-center justify-center h-screen">User not found.</div>;
  }

  return (
    <div className="min-h-screen bg-linkedin-bg">
      <Header />
      
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Profile header */}
        <div className="bg-white rounded-lg shadow overflow-hidden mb-4">
          {/* Cover photo */}
          <div 
            className="h-48 md:h-60 w-full bg-gradient-to-r from-blue-400 to-blue-600" 
            style={{
              backgroundImage: profileUser?.avatarUrl ? `url(${profileUser.avatarUrl})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            {isCurrentUserProfile && (
              <div className="flex justify-end p-4">
                <Button variant="ghost" size="icon" className="bg-white/80 hover:bg-white">
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          
          <div className="p-5 relative">
            {/* Avatar */}
            <div className="absolute -top-20 left-4">
              <Avatar className="h-36 w-36 border-4 border-white shadow-md">
                <AvatarImage src={profileUser?.avatarUrl} />
                <AvatarFallback className="bg-gray-200">
                  <User className="h-16 w-16 text-gray-500" />
                </AvatarFallback>
              </Avatar>
              {isCurrentUserProfile && (
                <div className="absolute right-1 bottom-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 bg-white rounded-full border shadow-sm">
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            
            {/* Profile info */}
            <div className="mt-16 md:flex md:justify-between md:items-center">
              <div>
                <h1 className="text-2xl font-bold">{profileUser?.name}</h1>
                <p className="text-gray-700 mt-1">{profileUser?.title}</p>
                <div className="flex items-center text-gray-500 mt-2 text-sm">
                  {profileUser?.location && (
                    <>
                      <MapPin className="h-4 w-4 mr-1" />
                      <span>{profileUser.location}</span>
                      <span className="mx-2">•</span>
                    </>
                  )}
                </div>
                <div className="text-sm text-linkedin-blue font-medium mt-2">
                  {connections.length} connections
                </div>
              </div>
              {isCurrentUserProfile ? (
                <div className="mt-4 md:mt-0 flex space-x-2">
                </div>
              ) : (
                <div className="mt-4 md:mt-0 flex space-x-2">
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Tabs and content */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-8 space-y-4">
            <Tabs defaultValue="posts" className="w-full">
              <div className="bg-white rounded-lg shadow mb-4">
                <TabsList className="w-full justify-start border-b p-0">
                  <TabsTrigger value="posts" className="rounded-none py-3 px-4 data-[state=active]:border-b-2 data-[state=active]:border-black">Posts</TabsTrigger>
                  <TabsTrigger value="activity" className="rounded-none py-3 px-4 data-[state=active]:border-b-2 data-[state=active]:border-black">Activity</TabsTrigger>
                  <TabsTrigger value="about" className="rounded-none py-3 px-4 data-[state=active]:border-b-2 data-[state=active]:border-black">About</TabsTrigger>
                </TabsList>
              </div>
              
              <TabsContent value="posts" className="space-y-4 mt-0">
                {posts.length > 0 && isCurrentUserProfile && (
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center mb-3">
                        <h3 className="font-medium">Activity</h3>
                        <span className="ml-2 text-sm text-gray-500">{posts.length} posts</span>
                      </div>
                      <div className="flex space-x-2">
                        <Button variant="ghost" size="sm" className="text-linkedin-blue">Posts</Button>
                        <Button variant="ghost" size="sm" className="text-gray-500">Comments</Button>
                        <Button variant="ghost" size="sm" className="text-gray-500">Images</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {posts.length === 0 && !postsLoading && (
                   <Card>
                     <CardContent className="p-4">
                       <h3 className="font-medium text-center text-gray-500">No posts yet</h3>
                     </CardContent>
                   </Card>
                 )}

                {posts.map(post => (
                  <PostCard 
                    key={post._id || post.id}
                    id={post._id || post.id}
                    author={{
                      ...post.author,
                      profileUrl: `/profile/${post.author.username}`
                    }}
                    content={post.content}
                    imageUrl={post.imageUrl}
                    timestamp={post.timestamp}
                    likes={post.likes}
                    comments={post.comments}
                    isLiked={post.isLiked}
                  />
                ))}
              </TabsContent>
              
              <TabsContent value="activity" className="space-y-4 mt-0">
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-medium">No recent activity</h3>
                    <p className="text-sm text-gray-500 mt-2">User's shared posts, comments, or reactions will be displayed here.</p>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="about" className="mt-0">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <h3 className="font-medium">About</h3>
                      {isCurrentUserProfile && (
                        <Button variant="ghost" size="icon">
                          <PenSquare className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-sm mt-2 whitespace-pre-line">{profileUser?.bio || "No bio available."}</p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
          
          <div className="col-span-12 lg:col-span-4 space-y-4">
            {/* Experience section */}
            <Card>
              <CardContent className="p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-medium">Experience</h3>
                  {isCurrentUserProfile && (
                    <div className="flex space-x-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <PenSquare className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">No experience added yet.</p>
                </div>
              </CardContent>
            </Card>
            
            {/* Education section */}
            <Card>
              <CardContent className="p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-medium">Education</h3>
                  {isCurrentUserProfile && (
                    <div className="flex space-x-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <PenSquare className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">No education added yet.</p>
                </div>
              </CardContent>
            </Card>
            
            {/* Skills section */}
            <Card>
              <CardContent className="p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-medium">Skills</h3>
                  {isCurrentUserProfile && (
                    <div className="flex space-x-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <PenSquare className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                
                <div className="space-y-3">
                  <p className="text-sm text-gray-500">No skills added yet.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
