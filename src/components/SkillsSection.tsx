import React, { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Plus, ThumbsUp, Trash } from 'lucide-react';
import { fetchUserSkills, createSkill, deleteSkill, endorseSkill, removeEndorsement } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Skill {
  _id: string;
  name: string;
  endorsements: number;
  endorsedBy: string[];
}

interface SkillsSectionProps {
  userId: string;
  isOwnProfile: boolean;
}

export default function SkillsSection({ userId, isOwnProfile }: SkillsSectionProps) {
  const { getAccessTokenSilently, user } = useAuth0();
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Fetch skills data
  const { data: skills = [], isLoading } = useQuery<Skill[]>({
    queryKey: ['skills', userId],
    queryFn: async () => {
      const token = await getAccessTokenSilently();
      return fetchUserSkills(token, userId);
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; category: string }) => {
      const token = await getAccessTokenSilently();
      return createSkill(token, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills', userId] });
      setIsAddModalOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getAccessTokenSilently();
      return deleteSkill(token, id);
    },
    onMutate: async (deletedId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['skills', userId] });

      // Snapshot the previous value
      const previousSkills = queryClient.getQueryData<Skill[]>(['skills', userId]);

      // Optimistically update to the new value
      queryClient.setQueryData<Skill[]>(['skills', userId], (old = []) => {
        return old.filter(skill => skill._id !== deletedId);
      });

      // Return a context object with the snapshotted value
      return { previousSkills };
    },
    onError: (err, newSkill, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      queryClient.setQueryData(['skills', userId], context?.previousSkills);
    },
    onSettled: () => {
      // Always refetch after error or success to make sure our optimistic update matches the server state
      queryClient.invalidateQueries({ queryKey: ['skills', userId] });
    },
  });

  const endorseMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getAccessTokenSilently();
      return endorseSkill(token, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills', userId] });
    },
  });

  const removeEndorsementMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getAccessTokenSilently();
      return removeEndorsement(token, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills', userId] });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      category: formData.get('category') as string,
    };
    createMutation.mutate(data);
  };

  const handleEndorsement = (skill: Skill) => {
    if (!user?.sub) return;
    
    if (skill.endorsedBy.includes(user.sub)) {
      removeEndorsementMutation.mutate(skill._id);
    } else {
      endorseMutation.mutate(skill._id);
    }
  };

  if (isLoading) {
    return <div className="animate-pulse">Loading skills...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Skills</h2>
        {isOwnProfile && (
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add skill
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2">
        {skills.map((skill) => (
          <Card key={skill._id} className="hover:bg-gray-50">
            <CardContent className="p-3">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">{skill.name}</h3>
                  <div className="text-xs text-gray-500">
                    {skill.endorsements} endorsement{skill.endorsements !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="flex gap-1">
                  {!isOwnProfile && user?.sub && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEndorsement(skill)}
                      className={`h-7 w-7 ${skill.endorsedBy.includes(user.sub) ? 'text-linkedin-blue' : 'text-gray-400 hover:text-gray-500'}`}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {isOwnProfile && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(skill._id)}
                      className="h-7 w-7 text-gray-400 hover:text-gray-500"
                    >
                      <Trash className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {skills.length === 0 && (
          <div className="text-center text-gray-500 py-6">
            No skills added yet.
          </div>
        )}
      </div>

      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Skill</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Skill Name</label>
              <Input
                name="name"
                required
                placeholder="e.g. React, Project Management, Data Analysis"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select name="category" required>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="soft-skills">Soft Skills</SelectItem>
                  <SelectItem value="languages">Languages</SelectItem>
                  <SelectItem value="tools">Tools & Software</SelectItem>
                  <SelectItem value="industry">Industry Knowledge</SelectItem>
                  <SelectItem value="certifications">Certifications</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Add Skill</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
} 