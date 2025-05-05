import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { User } from "lucide-react";
import { Link } from "react-router-dom";

interface ConnectionCardProps {
  id: string;
  name: string;
  title?: string;
  avatarUrl?: string;
  mutualConnections?: number;
  profileUrl: string;
  onConnect?: (id: string) => void;
  isConnected?: boolean;
  layout?: 'grid' | 'list' | 'compact';
}

export default function ConnectionCard({
  id,
  name,
  title,
  avatarUrl,
  mutualConnections,
  profileUrl,
  onConnect,
  isConnected,
  layout = 'compact'
}: ConnectionCardProps) {
  if (layout === 'compact') {
    return (
      <div className="flex items-center gap-3 py-2">
        <Link to={profileUrl}>
          <Avatar className="h-12 w-12 flex-shrink-0">
            <AvatarImage src={avatarUrl} />
            <AvatarFallback className="bg-gray-200">
              <User className="h-6 w-6 text-gray-500" />
            </AvatarFallback>
          </Avatar>
        </Link>
        
        <div className="flex-1 min-w-0">
          <Link to={profileUrl}>
            <h3 className="text-sm font-medium hover:underline leading-tight">{name}</h3>
          </Link>
          
          {title && <p className="text-xs text-gray-600 leading-tight truncate mt-0.5">{title}</p>}
          
          {mutualConnections !== undefined && mutualConnections > 0 && (
            <p className="text-xs text-gray-500 leading-tight mt-0.5">
              {mutualConnections} mutual connection{mutualConnections !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        
        <div className="flex-shrink-0">
          {isConnected ? (
            <Button 
              variant="outline"
              size="sm"
              className="text-xs h-7 border-gray-300 hover:border-gray-400 hover:bg-gray-50 whitespace-nowrap"
              asChild
            >
              <Link to={`/messages/${id}`}>Message</Link>
            </Button>
          ) : onConnect && (
            <Button 
              variant="outline"
              size="sm"
              className="text-xs h-7 border-gray-300 hover:border-gray-400 hover:bg-gray-50 whitespace-nowrap"
              onClick={() => onConnect(id)}
            >
              Connect
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className={layout === 'grid' ? 'p-6' : 'p-4'}>
      <CardContent className={`p-0 ${layout === 'grid' ? 'h-full' : ''}`}>
        <div className={`flex ${layout === 'grid' ? 'flex-col h-full' : 'items-center justify-between'}`}>
          <div className={`flex ${layout === 'grid' ? 'flex-col items-center flex-1' : 'items-center'} ${layout === 'list' ? 'space-x-3' : ''}`}>
            <Link to={profileUrl} className={layout === 'grid' ? 'mb-3' : ''}>
              <Avatar className={layout === 'grid' ? 'h-16 w-16' : 'h-10 w-10'}>
                <AvatarImage src={avatarUrl} />
                <AvatarFallback>
                  <User className={layout === 'grid' ? 'h-8 w-8' : 'h-5 w-5'} />
                </AvatarFallback>
              </Avatar>
            </Link>
            <div className={`${layout === 'grid' ? 'text-center' : ''}`}>
              <Link to={profileUrl} className="font-medium text-sm hover:underline block">
                {name}
              </Link>
              {title && (
                <p className="text-xs text-gray-500 mt-1">{title}</p>
              )}
              {mutualConnections !== undefined && mutualConnections > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  {mutualConnections} mutual connection{mutualConnections !== 1 && 's'}
                </p>
              )}
            </div>
          </div>
          <div className={`${layout === 'grid' ? 'mt-auto pt-4 w-full' : ''}`}>
            {!isConnected && onConnect && (
              <Button
                variant="outline"
                size={layout === 'grid' ? 'default' : 'sm'}
                className={layout === 'grid' ? 'w-full' : 'h-8'}
                onClick={() => onConnect(id)}
              >
                Connect
              </Button>
            )}
            {isConnected && (
              <Button
                variant="outline"
                size={layout === 'grid' ? 'default' : 'sm'}
                className={layout === 'grid' ? 'w-full' : 'h-8'}
                asChild
              >
                <Link to={`/messages/${id}`}>Message</Link>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
