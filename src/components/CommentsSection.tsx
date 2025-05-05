import React, { useState, KeyboardEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchComments, addComment } from '@/lib/api';
import { useAuth0 } from '@auth0/auth0-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { User } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CommentsSectionProps {
  postId: string;
}

interface Comment {
  _id: string;
  content: string;
  createdAt: string;
  author: {
    sub: string;
    username: string;
    name: string;
    title?: string;
    avatarUrl?: string;
  };
}

// Helper function copied from PostCard.tsx
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

// Add helper function for full timestamp
const getFormattedTimestamp = (isoString: string) => {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return "Invalid date";
    }
    return date.toLocaleString();
  } catch (error) {
    console.error("Error formatting timestamp:", error);
    return "Invalid date";
  }
};

export default function CommentsSection({ postId }: CommentsSectionProps) {
  const { getAccessTokenSilently } = useAuth0();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');

  const { data: comments = [], isLoading } = useQuery<Comment[], Error>({
    queryKey: ['comments', postId],
    queryFn: async () => {
      const token = await getAccessTokenSilently();
      return fetchComments(token, postId);
    },
    enabled: !!postId,
  });

  const addCommentMutation = useMutation<Comment, Error, string>({
    mutationFn: async (content: string) => {
      const token = await getAccessTokenSilently();
      return addComment(token, postId, content);
    },
    onSuccess: async () => {
      setNewComment('');
      try {
        console.log(`Invalidating queries for postId: ${postId}`);
        await queryClient.invalidateQueries({ queryKey: ['comments', postId] });
        await queryClient.invalidateQueries({ queryKey: ['feed'] });
        await queryClient.invalidateQueries({ queryKey: ['userPosts'] });
        
        console.log("Attempting refetch of feed and userPosts after comment...");
        await queryClient.refetchQueries({ queryKey: ['feed'], exact: true });
        await queryClient.refetchQueries({ queryKey: ['userPosts'], exact: true });
        console.log("Refetch attempt complete.");
      } catch (error) {
          console.error("Error during query invalidation/refetch after comment:", error);
      }
    },
  });

  const handleCommentKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape') {
          setNewComment('');
      } else if (event.key === 'Enter') {
          event.preventDefault(); // Prevent default form submission if any
          if (newComment.trim()) {
              addCommentMutation.mutate(newComment);
          }
      }
  };

  if (isLoading) {
    return <div className="p-4 text-sm text-gray-500">Loading comments…</div>;
  }

  return (
    <div className="p-4 border-t space-y-4">
      {comments.map(c => (
        <div key={c._id} className="flex items-start space-x-3">
          <Link to={`/profile/${c.author.username}`}>
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarImage src={c.author.avatarUrl} />
              <AvatarFallback>
                <User className="h-4 w-4 text-gray-500" />
              </AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1">
            <Link to={`/profile/${c.author.username}`} className="font-medium text-sm hover:underline block">
              {c.author.name}
            </Link>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-gray-500 cursor-help block mt-0.5">
                    {timeAgo(c.createdAt)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{getFormattedTimestamp(c.createdAt)}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <p className="text-sm text-gray-700 mt-1">{c.content}</p>
          </div>
        </div>
      ))}

      <div className="flex space-x-2">
        <Input
          type="text"
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          placeholder="Add a comment…"
          onKeyDown={handleCommentKeyDown}
        />
        <Button
          onClick={() => addCommentMutation.mutate(newComment)}
          disabled={!newComment.trim() || addCommentMutation.status === 'pending'}
        >
          Post
        </Button>
      </div>
    </div>
  );
} 