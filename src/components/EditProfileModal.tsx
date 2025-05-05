import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { useAuth0 } from '@auth0/auth0-react';
import { upsertUser } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: {
    sub: string;
    name: string;
    title?: string;
    bio?: string;
    location?: string;
  };
}

interface FormData {
  title: string;
  bio: string;
  location: string;
}

export default function EditProfileModal({ isOpen, onClose, currentProfile }: EditProfileModalProps) {
  const { getAccessTokenSilently } = useAuth0();
  const queryClient = useQueryClient();
  
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<FormData>({
    defaultValues: {
      title: currentProfile.title || '',
      bio: currentProfile.bio || '',
      location: currentProfile.location || '',
    }
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const token = await getAccessTokenSilently();
      return upsertUser(token, {
        ...currentProfile,
        ...data,
      });
    },
    onSuccess: () => {
      // Invalidate and refetch user profile data
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
      queryClient.invalidateQueries({ queryKey: ['userProfileByUsername'] });
      onClose();
    },
  });

  const onSubmit = async (data: FormData) => {
    await updateProfileMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium">
              Headline
            </label>
            <Input
              id="title"
              placeholder="Software Engineer at Company"
              {...register('title')}
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="bio" className="text-sm font-medium">
              Bio
            </label>
            <Textarea
              id="bio"
              placeholder="Tell us about yourself"
              className="min-h-[100px]"
              {...register('bio')}
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="location" className="text-sm font-medium">
              Location
            </label>
            <Input
              id="location"
              placeholder="City, Country"
              {...register('location')}
            />
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 