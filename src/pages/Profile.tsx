import React, { useState } from 'react';
import Header from "@/components/Header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Edit, MapPin, PenSquare, Plus, User } from "lucide-react";
import PostCard from "@/components/PostCard";
import { useAuth0 } from '@auth0/auth0-react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { fetchCurrentUser, fetchUserByUsername, fetchUserPosts, fetchConnections, fetchUserConnections, fetchUserComments } from '@/lib/api';
import CommentCard from '@/components/CommentCard';
import EditProfileModal from '@/components/EditProfileModal';
import ExperienceSection from '@/components/ExperienceSection';
import EducationSection from '@/components/EducationSection';
import SkillsSection from '@/components/SkillsSection';

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

// Update UserComment interface
interface UserComment {
  _id: string;
  content: string;
  createdAt: string;
  author: {
    _id: string;
    username: string;
    name: string;
    title?: string;
    avatarUrl?: string;
  };
  post: {
    _id: string;
    content: string;
    comments: number;
    author: {
      _id: string;
      username: string;
      name: string;
      title?: string;
      avatarUrl?: string;
    };
  };
}

export default function Profile() {
  const { username } = useParams<{ username: string }>();
  const { user: authUser, getAccessTokenSilently, isAuthenticated, isLoading: authLoading } = useAuth0();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

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

  // Add comments query
  const { data: comments = [], isLoading: commentsLoading } = useQuery<UserComment[], Error>({
    queryKey: ['userComments', targetUserId],
    queryFn: async () => {
      if (!targetUserId) throw new Error("Target User ID not available for comments fetch");
      const token = await getAccessTokenSilently();
      return fetchUserComments(token, targetUserId);
    },
    enabled: isAuthenticated && !!targetUserId,
  });

  const isLoading = authLoading || userLoading || (!!targetUserId && (connLoading || postsLoading || commentsLoading));

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
            <div className="mt-16">
              <div className="md:flex md:justify-between md:items-start">
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
                    <span className="text-linkedin-blue font-medium">
                      {connections.length} connections
                    </span>
                  </div>
                </div>
                {isCurrentUserProfile ? (
                  <div className="mt-4 md:mt-0 flex space-x-2">
                    <Button 
                      variant="outline" 
                      className="w-full md:w-auto"
                      onClick={() => setIsEditModalOpen(true)}
                    >
                      Edit profile
                    </Button>
                  </div>
                ) : (
                  <div className="mt-4 md:mt-0 flex space-x-2">
                    <Button className="w-full md:w-auto">
                      Connect
                    </Button>
                    <Button variant="outline" className="w-full md:w-auto">
                      Message
                    </Button>
                  </div>
                )}
              </div>

              {/* About section */}
              <div className="mt-6 border-t pt-6">
                <div className="flex justify-between items-start">
                  <h3 className="font-medium text-lg">About</h3>
                  {isCurrentUserProfile && (
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => setIsEditModalOpen(true)}
                    >
                      <PenSquare className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-sm mt-2 whitespace-pre-line">{profileUser?.bio || "No bio available."}</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Content grid */}
        <div className="grid grid-cols-12 gap-4">
          {/* Main content */}
          <div className="col-span-12 lg:col-span-8 space-y-4">
            <Tabs defaultValue="posts" className="w-full">
              <div className="bg-white rounded-lg shadow mb-4">
                <TabsList className="w-full justify-start border-b p-0">
                  <TabsTrigger value="posts" className="rounded-none py-3 px-4 data-[state=active]:border-b-2 data-[state=active]:border-black">
                    Posts
                    <span className="ml-2 text-xs text-gray-500">{posts.length}</span>
                  </TabsTrigger>
                  <TabsTrigger value="comments" className="rounded-none py-3 px-4 data-[state=active]:border-b-2 data-[state=active]:border-black">
                    Comments
                    <span className="ml-2 text-xs text-gray-500">{comments.length}</span>
                  </TabsTrigger>
                </TabsList>
              </div>
              
              <TabsContent value="posts" className="space-y-4 mt-0">
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
              
              <TabsContent value="comments" className="space-y-4 mt-0">
                {commentsLoading ? (
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="font-medium text-center text-gray-500">Loading comments...</h3>
                    </CardContent>
                  </Card>
                ) : comments.length === 0 ? (
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="font-medium text-center text-gray-500">No comments yet</h3>
                    </CardContent>
                  </Card>
                ) : (
                  comments.map(comment => (
                    <CommentCard key={comment._id} comment={comment} />
                  ))
                )}
              </TabsContent>
            </Tabs>
          </div>
          
          {/* Sidebar */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            {/* Experience section */}
            <Card>
              <CardContent className="p-4">
                <ExperienceSection 
                  userId={profileUser._id} 
                  isOwnProfile={isCurrentUserProfile} 
                />
              </CardContent>
            </Card>
            
            {/* Education section */}
            <Card>
              <CardContent className="p-4">
                <EducationSection 
                  userId={profileUser._id} 
                  isOwnProfile={isCurrentUserProfile} 
                />
              </CardContent>
            </Card>
            
            {/* Skills section */}
            <Card>
              <CardContent className="p-4">
                <SkillsSection 
                  userId={profileUser._id} 
                  isOwnProfile={isCurrentUserProfile} 
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Edit Profile Modal */}
      {isCurrentUserProfile && (
        <EditProfileModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          currentProfile={{
            sub: profileUser.sub || '',
            name: profileUser.name,
            title: profileUser.title,
            bio: profileUser.bio,
            location: profileUser.location,
          }}
        />
      )}
    </div>
  );
}
