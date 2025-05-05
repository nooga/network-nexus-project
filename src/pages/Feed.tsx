import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth0 } from '@auth0/auth0-react';
import { fetchFeed, fetchSuggestions, createConnection, fetchCurrentUser, fetchConnections } from '@/lib/api';
import CreatePostCard from "@/components/CreatePostCard";
import Header from "@/components/Header";
import PostCard from "@/components/PostCard";
import ProfileCard from "@/components/ProfileCard";
import ConnectionCard from "@/components/ConnectionCard";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "lucide-react";
import { Link } from "react-router-dom";

// Type for feed post data fetched from API
interface FeedPost {
  _id: string;
  id: string;
  author: {
    _id: string;
    username: string;
    name: string;
    title?: string;
    avatarUrl?: string;
    profileUrl?: string;
  };
  content: string;
  imageUrl?: string;
  timestamp: string;
  likes: number;
  comments: number;
  isLiked?: boolean;
}

// Type for connection suggestion
interface Suggestion {
  _id: string;
  sub: string;
  username: string;
  name: string;
  title?: string;
  avatarUrl?: string;
}

// Types for user and connections
interface UserProfile { sub: string; name: string; title?: string; avatarUrl?: string; location?: string; }
interface ConnectionUser { _id: string; name: string; title?: string; avatarUrl?: string; }

export default function Feed() {
  const { getAccessTokenSilently, isAuthenticated, isLoading: authLoading } = useAuth0();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);
  
  // Set up periodic refresh
  useEffect(() => {
    if (!isAuthenticated) return;
    
    // Refresh feed every 30 seconds
    const intervalId = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    }, 30000);
    
    return () => clearInterval(intervalId);
  }, [isAuthenticated, queryClient]);
  
  // Set up infinite scroll
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          setPage((prevPage) => prevPage + 1);
        }
      },
      { threshold: 0.1 }
    );
    
    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }
    
    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [isAuthenticated, hasMore, isLoadingMore]);
  
  const connectMutation = useMutation<unknown, Error, string>({
    mutationFn: async (id: string) => {
      const token = await getAccessTokenSilently();
      return createConnection(token, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  const { 
    data: posts = [], 
    isLoading: postsLoading,
    isFetching: isFetchingPosts
  } = useQuery<FeedPost[], Error>({
    queryKey: ['feed', page],
    queryFn: async () => {
      const token = await getAccessTokenSilently();
      setIsLoadingMore(true);
      try {
        const newPosts = await fetchFeed(token, page);
        
        // Debug timestamps
        if (newPosts && newPosts.length > 0) {
          console.log("First post timestamp:", newPosts[0].timestamp);
          console.log("First post timestamp type:", typeof newPosts[0].timestamp);
          
          // Try to parse the timestamp
          try {
            const date = new Date(newPosts[0].timestamp);
            console.log("Parsed date:", date.toISOString());
            console.log("Is valid date:", !isNaN(date.getTime()));
          } catch (error) {
            console.error("Error parsing timestamp:", error);
          }
        }
        
        // If we get fewer posts than the limit, we've reached the end
        if (newPosts.length < 50) {
          setHasMore(false);
        }
        return newPosts;
      } finally {
        setIsLoadingMore(false);
      }
    },
    enabled: isAuthenticated,
    // Don't refetch on window focus to avoid disrupting infinite scroll
    refetchOnWindowFocus: false,
    // Use placeholderData instead of keepPreviousData
    placeholderData: (previousData) => previousData || [],
  });

  const {
    data: suggestions = [],
    isLoading: suggestionsLoading
  } = useQuery<Suggestion[], Error>({
    queryKey: ['suggestions'],
    queryFn: async () => {
      const token = await getAccessTokenSilently();
      return fetchSuggestions(token);
    },
    enabled: isAuthenticated,
  });

  // Fetch current user and their connections for the profile card
  const { data: user, isLoading: userLoading } = useQuery<UserProfile, Error>({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const token = await getAccessTokenSilently();
      return fetchCurrentUser(token);
    },
    enabled: isAuthenticated,
  });
  const { data: connectionsList = [], isLoading: connLoading } = useQuery<ConnectionUser[], Error>({
    queryKey: ['connections'],
    queryFn: async () => {
      const token = await getAccessTokenSilently();
      return fetchConnections(token);
    },
    enabled: isAuthenticated,
  });

  if (authLoading || (postsLoading && page === 1) || userLoading || connLoading) {
    return <div className="flex items-center justify-center h-screen">Loading feed…</div>;
  }

  return (
    <div className="min-h-screen bg-linkedin-bg">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left sidebar */}
          <div className="lg:col-span-3 space-y-4">
            <ProfileCard
              className="mb-4"
              name={user?.name}
              title={user?.title}
              location={user?.location}
              avatarUrl={user?.avatarUrl}
              connectionCount={connectionsList.length}
              isCurrentUser
            />
            
            <Card className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-gray-500">Connections</span>
                  <Link to="/network" className="text-xs text-blue-600 hover:underline">See all</Link>
                </div>
                <h4 className="text-base font-semibold mb-3">Grow your network</h4>
                <div className="space-y-1">
                  {suggestionsLoading ? (
                    <div>Loading suggestions…</div>
                  ) : (
                    suggestions.slice(0, 2).map(connection => (
                      <ConnectionCard
                        key={connection._id}
                        id={connection._id}
                        name={connection.name}
                        title={connection.title}
                        avatarUrl={connection.avatarUrl}
                        profileUrl={`/profile/${connection.username}`}
                        onConnect={(id) => connectMutation.mutate(id)}
                      />
                    ))
                  )}
                </div>
              </div>
            </Card>
          </div>
          
          {/* Main content */}
          <div className="lg:col-span-6 space-y-4">
            <CreatePostCard />
            
            {/* Check for empty feed after loading */}
            {!postsLoading && Array.isArray(posts) && posts.length === 0 && (
              <div className="bg-white rounded-lg shadow p-6 text-center">
                <svg 
                  className="mx-auto h-12 w-12 text-gray-400" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor" 
                  aria-hidden="true"
                >
                  <path 
                    vectorEffect="non-scaling-stroke" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l4-4m0 4l-4-4" 
                  />
                </svg>
                <h3 className="mt-2 text-lg font-medium text-gray-900">Your feed is quiet... too quiet!</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Start by connecting with people you know or share your thoughts.
                </p>
                <div className="mt-6 flex justify-center gap-4">
                  <Link to="/network">
                    <Button variant="outline">
                      Find Connections
                    </Button>
                  </Link>
                  {/* Optional: Add a button to focus the CreatePostCard */}
                  {/* <Button>Create Post</Button> */}
                </div>
              </div>
            )}

            {/* Render posts if not empty */}
            {Array.isArray(posts) && posts.map(post => (
              <PostCard 
                key={post._id}
                id={post._id}
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
            
            {/* Infinite scroll observer target */}
            <div ref={observerTarget} className="h-10 flex items-center justify-center">
              {isLoadingMore && (
                <div className="text-gray-500">Loading more posts...</div>
              )}
              {!hasMore && Array.isArray(posts) && posts.length > 0 && (
                <div className="text-gray-500">No more posts to load</div>
              )}
            </div>
          </div>
          
          {/* Right sidebar */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-base font-medium mb-3">Add to your feed</h3>
              <div className="space-y-4">
                {suggestionsLoading ? (
                  <div>Loading suggestions…</div>
                ) : (
                  suggestions.slice(0, 2).map(suggestion => (
                    <ConnectionCard
                      key={suggestion._id}
                      id={suggestion._id}
                      name={suggestion.name}
                      title={suggestion.title}
                      avatarUrl={suggestion.avatarUrl}
                      profileUrl={`/profile/${suggestion.username}`}
                      onConnect={(id) => connectMutation.mutate(id)}
                    />
                  ))
                )}
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-base font-medium mb-2">LinkedIn News</h3>
              <ul className="space-y-3">
                <li>
                  <a href="#" className="text-sm font-medium hover:text-linkedin-blue">Tech layoffs continue across industry</a>
                  <p className="text-xs text-gray-500">1d ago • 2,543 readers</p>
                </li>
                <li>
                  <a href="#" className="text-sm font-medium hover:text-linkedin-blue">Remote work trends in 2023</a>
                  <p className="text-xs text-gray-500">3d ago • 15,423 readers</p>
                </li>
                <li>
                  <a href="#" className="text-sm font-medium hover:text-linkedin-blue">AI changing the job market</a>
                  <p className="text-xs text-gray-500">2d ago • 8,741 readers</p>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Card({ children, className = "" }) {
  return <div className={`bg-white rounded-lg shadow overflow-hidden ${className}`}>{children}</div>;
}
