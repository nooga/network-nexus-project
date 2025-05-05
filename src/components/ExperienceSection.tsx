import React, { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { Building2, Calendar, MapPin, Pencil, Plus, Trash } from 'lucide-react';
import { fetchUserExperience, createExperience, updateExperience, deleteExperience } from '@/lib/api';

interface Experience {
  _id: string;
  title: string;
  company: string;
  location?: string;
  startDate: string;
  endDate?: string;
  current: boolean;
  description?: string;
  employmentType?: "full-time" | "part-time" | "self-employed" | "freelance" | "contract" | "internship";
  industry?: string;
}

interface ExperienceFormData {
  title: string;
  company: string;
  location?: string;
  startDate: Date;
  endDate?: Date;
  current: boolean;
  description?: string;
  employmentType?: Experience["employmentType"];
  industry?: Experience["industry"];
}

interface ExperienceApiData {
  title: string;
  company: string;
  location?: string;
  startDate: string;
  endDate?: string;
  current: boolean;
  description?: string;
  employmentType?: Experience["employmentType"];
  industry?: Experience["industry"];
}

interface ExperienceSectionProps {
  userId: string;
  isOwnProfile: boolean;
}

export default function ExperienceSection({ userId, isOwnProfile }: ExperienceSectionProps) {
  const { getAccessTokenSilently } = useAuth0();
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingExperience, setEditingExperience] = useState<Experience | null>(null);

  // Fetch experience data
  const { data: experiences = [], isLoading } = useQuery<Experience[]>({
    queryKey: ['experience', userId],
    queryFn: async () => {
      const token = await getAccessTokenSilently();
      return fetchUserExperience(token, userId);
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (newExperience: ExperienceFormData) => {
      const token = await getAccessTokenSilently();
      const apiData: ExperienceApiData = {
        ...newExperience,
        startDate: newExperience.startDate.toISOString(),
        endDate: newExperience.endDate?.toISOString(),
      };
      return createExperience(token, apiData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experience', userId] });
      setIsAddModalOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ExperienceFormData }) => {
      const token = await getAccessTokenSilently();
      const apiData: Partial<ExperienceApiData> = {
        ...data,
        startDate: data.startDate.toISOString(),
        endDate: data.endDate?.toISOString(),
      };
      return updateExperience(token, id, apiData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experience', userId] });
      setEditingExperience(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getAccessTokenSilently();
      return deleteExperience(token, id);
    },
    onMutate: async (deletedId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['experience', userId] });

      // Snapshot the previous value
      const previousExperiences = queryClient.getQueryData<Experience[]>(['experience', userId]);

      // Optimistically update to the new value
      queryClient.setQueryData<Experience[]>(['experience', userId], (old = []) => {
        return old.filter(exp => exp._id !== deletedId);
      });

      // Return a context object with the snapshotted value
      return { previousExperiences };
    },
    onError: (err, newExperience, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      queryClient.setQueryData(['experience', userId], context?.previousExperiences);
    },
    onSettled: () => {
      // Always refetch after error or success to make sure our optimistic update matches the server state
      queryClient.invalidateQueries({ queryKey: ['experience', userId] });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: ExperienceFormData = {
      title: formData.get('title') as string,
      company: formData.get('company') as string,
      location: formData.get('location') as string,
      startDate: new Date(formData.get('startDate') as string),
      endDate: formData.get('current') === 'true' ? undefined : new Date(formData.get('endDate') as string),
      current: formData.get('current') === 'true',
      description: formData.get('description') as string,
      employmentType: formData.get('employmentType') as Experience['employmentType'],
      industry: formData.get('industry') as Experience['industry'],
    };

    if (editingExperience) {
      updateMutation.mutate({ id: editingExperience._id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  if (isLoading) {
    return <div className="animate-pulse">Loading experience...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Experience</h2>
        {isOwnProfile && (
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add experience
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {experiences.map((experience) => (
          <Card key={experience._id}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-gray-900">{experience.title}</h3>
                  <div className="mt-1 space-y-1">
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">{experience.company}</span>
                      {experience.employmentType && (
                        <span className="text-gray-500"> · {experience.employmentType.replace('-', ' ')}</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {format(new Date(experience.startDate), 'MMM yyyy')} -{' '}
                      {experience.current ? 'Present' : format(new Date(experience.endDate!), 'MMM yyyy')}
                      {experience.location && (
                        <>
                          <span className="mx-1">·</span>
                          <span>{experience.location}</span>
                        </>
                      )}
                    </div>
                    {experience.industry && (
                      <div className="text-sm text-gray-500">
                        Industry: {experience.industry.charAt(0).toUpperCase() + experience.industry.slice(1)}
                      </div>
                    )}
                  </div>
                  {experience.description && (
                    <p className="mt-3 text-sm text-gray-600 whitespace-pre-line">{experience.description}</p>
                  )}
                </div>
                {isOwnProfile && (
                  <div className="flex gap-1 ml-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingExperience(experience)}
                      className="h-8 w-8 text-gray-500 hover:text-gray-700"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(experience._id)}
                      className="h-8 w-8 text-gray-500 hover:text-gray-700"
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {experiences.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            No experience added yet.
          </div>
        )}
      </div>

      <Dialog open={isAddModalOpen || !!editingExperience} onOpenChange={(open) => {
        if (!open) {
          setIsAddModalOpen(false);
          setEditingExperience(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingExperience ? 'Edit Experience' : 'Add Experience'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                name="title"
                defaultValue={editingExperience?.title}
                required
                placeholder="e.g. Software Engineer"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Company</label>
              <Input
                name="company"
                defaultValue={editingExperience?.company}
                required
                placeholder="e.g. Acme Corp"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Employment Type</label>
              <Select name="employmentType" defaultValue={editingExperience?.employmentType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employment type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full-time">Full-time</SelectItem>
                  <SelectItem value="part-time">Part-time</SelectItem>
                  <SelectItem value="self-employed">Self-employed</SelectItem>
                  <SelectItem value="freelance">Freelance</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="internship">Internship</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Industry</label>
              <Select name="industry" defaultValue={editingExperience?.industry} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technology">Technology</SelectItem>
                  <SelectItem value="healthcare">Healthcare</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="education">Education</SelectItem>
                  <SelectItem value="retail">Retail</SelectItem>
                  <SelectItem value="manufacturing">Manufacturing</SelectItem>
                  <SelectItem value="consulting">Consulting</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Location</label>
              <Input
                name="location"
                defaultValue={editingExperience?.location}
                placeholder="e.g. San Francisco, CA"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium">Start Date</label>
                <Input
                  type="date"
                  name="startDate"
                  defaultValue={editingExperience?.startDate?.split('T')[0]}
                  required
                />
              </div>
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium">End Date</label>
                <Input
                  type="date"
                  name="endDate"
                  defaultValue={editingExperience?.endDate?.split('T')[0]}
                  disabled={editingExperience?.current}
                  required={!editingExperience?.current}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                name="current"
                id="current"
                value="true"
                defaultChecked={editingExperience?.current}
                onChange={(e) => {
                  const endDateInput = e.currentTarget.form?.elements.namedItem('endDate') as HTMLInputElement;
                  if (endDateInput) {
                    endDateInput.disabled = e.currentTarget.checked;
                    if (e.currentTarget.checked) {
                      endDateInput.value = '';
                    }
                  }
                }}
              />
              <label htmlFor="current" className="text-sm">I currently work here</label>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                name="description"
                defaultValue={editingExperience?.description}
                placeholder="Describe your role and achievements..."
                className="h-32"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingExperience(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingExperience ? 'Save Changes' : 'Add Experience'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
} 