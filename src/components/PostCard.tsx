import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { likePost, unlikePost } from "@/lib/api";
import { useAuth0 } from "@auth0/auth0-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "react-router-dom";
import { Clock, Globe, MessageSquare, MoreHorizontal, Share2, ThumbsUp, User } from "lucide-react";
import { cn } from "@/lib/utils";
import CommentsSection from "@/components/CommentsSection";

interface PostCardProps {
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
  timestamp: string; // ISO string
  likes: number;
  comments: number;
  isLiked?: boolean;
}

export default function PostCard({
  id,
  author,
  content,
  imageUrl,
  timestamp,
  likes,
  comments,
  isLiked = false,
}: PostCardProps) {
  const [liked, setLiked] = useState(isLiked);
  const [likeCount, setLikeCount] = useState(likes);
  const [showComments, setShowComments] = useState(false);
  const { getAccessTokenSilently } = useAuth0();
  const likeMutation = useMutation<{ likes: number }, Error, boolean>({
    mutationFn: async (newLiked: boolean) => {
      const token = await getAccessTokenSilently();
      return newLiked ? likePost(token, id) : unlikePost(token, id);
    },
    onSuccess: (updated) => {
      setLikeCount(updated.likes);
      setLiked((prev) => !prev);
    },
  });

  const handleLike = () => {
    if (!id) {
      console.error("PostCard: Cannot like post, ID is missing.");
      return;
    }
    likeMutation.mutate(!liked);
  };

  const timeAgo = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 7) {
      return date.toLocaleDateString();
    } else if (diffDays > 0) {
      return `${diffDays}d`;
    } else if (diffHours > 0) {
      return `${diffHours}h`;
    } else if (diffMins > 0) {
      return `${diffMins}m`;
    } else {
      return 'just now';
    }
  };
  
  return (
    <>
      <Card>
        <CardHeader className="pt-4 pb-2 px-4">
          <div className="flex justify-between items-start">
            <div className="flex items-start space-x-3">
              <Link to={author.profileUrl}>
                <Avatar>
                  <AvatarImage src={author.avatarUrl} />
                  <AvatarFallback>
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              </Link>
              <div>
                <Link to={author.profileUrl}>
                  <h3 className="font-semibold text-sm hover:text-linkedin-blue hover:underline">
                    {author.name}
                  </h3>
                </Link>
                {author.title && (
                  <p className="text-xs text-gray-500">{author.title}</p>
                )}
                <div className="flex items-center text-xs text-gray-500 mt-0.5">
                  <span>{timeAgo(timestamp)}</span>
                  <span className="mx-1">•</span>
                  <Globe className="h-3 w-3" />
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 pt-1 pb-2">
          <p className="text-sm whitespace-pre-line">{content}</p>
          {imageUrl && (
            <div className="mt-3">
              <img 
                src={imageUrl} 
                alt="Post content" 
                className="w-full object-cover rounded" 
              />
            </div>
          )}
        </CardContent>
        
        {(likeCount > 0 || comments > 0) && (
          <div className="px-4 py-1">
            <div className="flex justify-between items-center text-xs text-gray-500">
              <div className="flex items-center">
                {likeCount > 0 && (
                  <div className="flex items-center">
                    <div className="bg-linkedin-blue rounded-full p-1 mr-1">
                      <ThumbsUp className="h-2 w-2 text-white" />
                    </div>
                    <span>{likeCount}</span>
                  </div>
                )}
              </div>
              {comments > 0 && (
                <button 
                  onClick={() => setShowComments(prev => !prev)}
                  className="hover:underline hover:text-linkedin-blue cursor-pointer"
                >
                  {comments} {comments === 1 ? 'comment' : 'comments'}
                </button>
              )}
            </div>
          </div>
        )}
        
        <Separator className="mt-2" />
        
        {id && (
          <CardFooter className="px-2 py-1">
            <div className="w-full flex justify-around items-center">
              <Button 
                variant="ghost" 
                size="sm" 
                className={cn(
                  "flex-1 flex items-center justify-center text-xs",
                  liked && "text-linkedin-blue"
                )}
                onClick={handleLike}
                disabled={!id}
              >
                <ThumbsUp className="h-4 w-4 mr-2" />
                Like
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="flex-1 flex items-center justify-center text-xs"
                onClick={() => setShowComments(prev => !prev)}
                disabled={!id}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Comment
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="flex-1 flex items-center justify-center text-xs"
                disabled={!id}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>
          </CardFooter>
        )}
        
        {id && showComments && (
          <>
            <CommentsSection postId={id} />
          </>
        )}
      </Card>
    </>
  );
}
