import React, { useState, useRef, useEffect } from "react";
import { Bell, Briefcase, Home, MessageSquare, Search, User, Users } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth0 } from "@auth0/auth0-react";
import { searchUsers, fetchCurrentUser, fetchPendingConnections } from "@/lib/api";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@/components/ui/command";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Logo } from "@/components/Logo";
import { Badge } from "@/components/ui/badge";

// Shape of a user returned by search
interface UserSearchResult {
  _id: string;
  sub: string;
  username: string;
  name: string;
  title?: string;
  avatarUrl?: string;
}

// Define UserProfile type for currentUser
interface UserProfile { 
  _id: string;
  name: string;
  avatarUrl?: string; 
}

// Type for pending connection invitations
interface PendingConnection {
  _id: string;
  from: {
    _id: string;
    sub: string;
    username: string;
    name: string;
    title?: string;
    avatarUrl?: string;
  };
}

export default function Header() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { getAccessTokenSilently, isAuthenticated, logout } = useAuth0();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Fetch current user for avatar
  const { data: user, isLoading: userLoading } = useQuery<UserProfile, Error>({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const token = await getAccessTokenSilently();
      return fetchCurrentUser(token);
    },
    enabled: isAuthenticated,
  });

  // Fetch pending invitations
  const { data: pendingInvitations = [], isLoading: pendingLoading } = useQuery<PendingConnection[], Error>({
    queryKey: ['pendingConnections'],
    queryFn: async () => {
      const token = await getAccessTokenSilently();
      return fetchPendingConnections(token);
    },
    enabled: isAuthenticated,
    // Refresh every 30 seconds
    refetchInterval: 30000,
  });

  const { data: searchResults = [], isLoading: searchLoading } = useQuery<UserSearchResult[], Error, UserSearchResult[]>({ 
      queryKey: ["search", searchQuery],
      queryFn: async () => {
        if (!searchQuery) return [];
        const token = await getAccessTokenSilently();
        return searchUsers(token, searchQuery);
      },
      enabled: isAuthenticated && searchQuery.length > 0,
      staleTime: 300_000,
    });

  useEffect(() => {
      setIsSearchOpen(searchQuery.length > 0);
  }, [searchQuery]);

  // Handle logo click - refresh feed if already on feed page, otherwise navigate to feed
  const handleLogoClick = (e: React.MouseEvent) => {
    if (location.pathname === '/') {
      // If already on feed, refresh it
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    } else {
      // Otherwise navigate to feed
      navigate('/');
    }
  };

  // Handle network click - navigate to invitations tab if there are pending invites
  const handleNetworkClick = (e: React.MouseEvent) => {
    if (pendingInvitations.length > 0) {
      navigate('/network?tab=invitations');
    } else {
      navigate('/network');
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div 
              className="flex-shrink-0 cursor-pointer" 
              onClick={handleLogoClick}
            >
              <Logo />
            </div>
            <Popover open={isSearchOpen} onOpenChange={setIsSearchOpen}>
              <PopoverTrigger asChild>
                <div className="ml-4 relative flex-grow max-w-xs hidden md:block">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <Input
                    ref={searchInputRef}
                    type="text"
                    className="pl-10 py-1.5 w-full bg-gray-100 focus:bg-white"
                    placeholder="Search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsSearchOpen(searchQuery.length > 0)}
                  />
                </div>
              </PopoverTrigger>
              <PopoverContent 
                 align="start" 
                 sideOffset={4} 
                 className="p-0 w-[--radix-popover-trigger-width]"
                 onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <Command className="w-full">
                  <CommandInput
                    placeholder="Search users..."
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {searchLoading ? "Loading..." : "No results found."}
                    </CommandEmpty>
                    {searchResults.map(searchUser => (
                      <CommandItem
                        key={searchUser.sub}
                        className="py-2"
                        onSelect={() => {
                          navigate(`/profile/${searchUser.username}`); 
                          setSearchQuery("");
                          setIsSearchOpen(false);
                        }}
                      >
                         <Avatar className="h-6 w-6 mr-2 flex-shrink-0">
                            <AvatarImage src={searchUser.avatarUrl} />
                            <AvatarFallback className="text-[10px]">
                               <User className="h-4 w-4" />
                            </AvatarFallback>
                         </Avatar>
                         <div>
                           <span className="block truncate font-medium text-sm">{searchUser.name}</span>
                           <span className="block truncate text-xs text-gray-500">{searchUser.title}</span>
                         </div>
                      </CommandItem>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <nav className="flex items-center space-x-1 md:space-x-4">
            <Link to="/" className="p-2 text-gray-500 hover:text-linkedin-blue flex flex-col items-center text-xs">
              <Home className="h-6 w-6" />
              <span className="hidden md:inline-block">Home</span>
            </Link>
            <div 
              className="p-2 text-gray-500 hover:text-linkedin-blue flex flex-col items-center text-xs cursor-pointer relative"
              onClick={handleNetworkClick}
            >
              <Users className="h-6 w-6" />
              <span className="hidden md:inline-block">My Network</span>
              {pendingInvitations.length > 0 && (
                <Badge className="absolute top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500">
                  {pendingInvitations.length}
                </Badge>
              )}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="p-2 text-gray-400 flex flex-col items-center text-xs cursor-default">
                  <Briefcase className="h-6 w-6" />
                  <span className="hidden md:inline-block">Jobs</span>
                </div>
              </TooltipTrigger>
              <TooltipContent><p>Coming Soon!</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                 <div className="p-2 text-gray-400 flex flex-col items-center text-xs cursor-default">
                    <MessageSquare className="h-6 w-6" />
                    <span className="hidden md:inline-block">Messaging</span>
                 </div>
              </TooltipTrigger>
              <TooltipContent><p>Coming Soon!</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                 <div className="p-2 text-gray-400 flex flex-col items-center text-xs cursor-default">
                   <Bell className="h-6 w-6" />
                   <span className="hidden md:inline-block">Notifications</span>
                 </div>
              </TooltipTrigger>
              <TooltipContent><p>Coming Soon!</p></TooltipContent>
            </Tooltip>

            <div className="border-l h-8 mx-1 border-gray-200 hidden md:block"></div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="p-2 flex flex-col items-center hover:text-linkedin-blue">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={user?.avatarUrl} />
                    <AvatarFallback className="text-[10px]">
                      {userLoading ? '' : <User className="h-4 w-4" />} 
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs hidden md:inline-block">Me</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="flex items-center">View Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="flex items-center">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <button
                    onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
                    className="w-full text-left"
                  >
                    Sign Out
                  </button>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>
      </div>
    </header>
  );
}
