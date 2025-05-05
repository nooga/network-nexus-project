import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { useAuth0 } from '@auth0/auth0-react';
import { fetchComments } from '@/lib/api';

interface CommentCardProps {
  comment: {
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
  };
}

interface Comment {
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
}

export default function CommentCard({ comment }: CommentCardProps) {
  const [showAllComments, setShowAllComments] = useState(false);
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  // Fetch all comments when "Show all comments" is clicked
  const { data: allComments = [], isLoading: commentsLoading } = useQuery<Comment[], Error>({
    queryKey: ['postComments', comment.post._id, showAllComments],
    queryFn: async () => {
      if (!showAllComments) return [];
      const token = await getAccessTokenSilently();
      return fetchComments(token, comment.post._id);
    },
    enabled: isAuthenticated && showAllComments,
  });

  return (
    <Card>
      <CardContent className="p-4">
        {/* Original post preview */}
        <div className="mb-4 pb-4 border-b">
          <div className="flex items-start space-x-3">
            <Link to={`/profile/${comment.post.author.username}`}>
              <Avatar className="h-10 w-10">
                <AvatarImage src={comment.post.author.avatarUrl} />
                <AvatarFallback><User className="h-5 w-5" /></AvatarFallback>
              </Avatar>
            </Link>
            <div className="flex-1 min-w-0">
              <Link 
                to={`/profile/${comment.post.author.username}`}
                className="font-medium hover:underline"
              >
                {comment.post.author.name}
              </Link>
              {comment.post.author.title && (
                <p className="text-sm text-gray-500">{comment.post.author.title}</p>
              )}
              <p className="mt-1 text-sm text-gray-900">{comment.post.content}</p>
            </div>
          </div>
        </div>

        {/* User's comment */}
        <div className="flex items-start space-x-3">
          <Link to={`/profile/${comment.author.username}`}>
            <Avatar className="h-8 w-8">
              <AvatarImage src={comment.author.avatarUrl} />
              <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="bg-gray-100 rounded-lg p-3">
              <Link 
                to={`/profile/${comment.author.username}`}
                className="font-medium hover:underline"
              >
                {comment.author.name}
              </Link>
              <p className="mt-1 text-sm">{comment.content}</p>
            </div>
            <div className="mt-1 text-xs text-gray-500">
              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
            </div>
          </div>
        </div>

        {/* Show all comments button */}
        {!showAllComments && comment.post.comments > 1 && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 text-gray-500"
            onClick={() => setShowAllComments(true)}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Show all {comment.post.comments} comments
          </Button>
        )}

        {/* All comments section */}
        {showAllComments && (
          <div className="mt-4 space-y-3">
            {commentsLoading ? (
              <p className="text-sm text-gray-500">Loading comments...</p>
            ) : (
              allComments.map((c: Comment) => (
                <div key={c._id} className="flex items-start space-x-3">
                  <Link to={`/profile/${c.author.username}`}>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={c.author.avatarUrl} />
                      <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                    </Avatar>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className={`bg-gray-100 rounded-lg p-3 ${c._id === comment._id ? 'border-2 border-linkedin-blue' : ''}`}>
                      <Link 
                        to={`/profile/${c.author.username}`}
                        className="font-medium hover:underline"
                      >
                        {c.author.name}
                      </Link>
                      <p className="mt-1 text-sm">{c.content}</p>
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 