import React, { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { GraduationCap, Calendar, MapPin, Pencil, Plus, Trash } from 'lucide-react';
import { fetchUserEducation, createEducation, updateEducation, deleteEducation } from '@/lib/api';

interface Education {
  _id: string;
  school: string;
  degree?: string;
  fieldOfStudy?: string;
  startDate: string;
  endDate?: string;
  current: boolean;
  description?: string;
  activities?: string;
  grade?: string;
}

interface EducationFormData {
  school: string;
  degree?: string;
  fieldOfStudy?: string;
  startDate: Date;
  endDate?: Date;
  current: boolean;
  description?: string;
  activities?: string;
  grade?: string;
}

interface EducationApiData {
  school: string;
  degree?: string;
  fieldOfStudy?: string;
  startDate: string;
  endDate?: string;
  current: boolean;
  description?: string;
  activities?: string;
  grade?: string;
}

interface EducationSectionProps {
  userId: string;
  isOwnProfile: boolean;
}

export default function EducationSection({ userId, isOwnProfile }: EducationSectionProps) {
  const { getAccessTokenSilently } = useAuth0();
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingEducation, setEditingEducation] = useState<Education | null>(null);

  // Fetch education data
  const { data: education = [], isLoading } = useQuery<Education[]>({
    queryKey: ['education', userId],
    queryFn: async () => {
      const token = await getAccessTokenSilently();
      return fetchUserEducation(token, userId);
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (newEducation: EducationFormData) => {
      const token = await getAccessTokenSilently();
      const apiData: EducationApiData = {
        ...newEducation,
        startDate: newEducation.startDate.toISOString(),
        endDate: newEducation.endDate?.toISOString(),
      };
      return createEducation(token, apiData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['education', userId] });
      setIsAddModalOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EducationFormData }) => {
      const token = await getAccessTokenSilently();
      const apiData: Partial<EducationApiData> = {
        ...data,
        startDate: data.startDate.toISOString(),
        endDate: data.endDate?.toISOString(),
      };
      return updateEducation(token, id, apiData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['education', userId] });
      setEditingEducation(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getAccessTokenSilently();
      return deleteEducation(token, id);
    },
    onMutate: async (deletedId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['education', userId] });

      // Snapshot the previous value
      const previousEducation = queryClient.getQueryData<Education[]>(['education', userId]);

      // Optimistically update to the new value
      queryClient.setQueryData<Education[]>(['education', userId], (old = []) => {
        return old.filter(edu => edu._id !== deletedId);
      });

      // Return a context object with the snapshotted value
      return { previousEducation };
    },
    onError: (err, newEducation, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      queryClient.setQueryData(['education', userId], context?.previousEducation);
    },
    onSettled: () => {
      // Always refetch after error or success to make sure our optimistic update matches the server state
      queryClient.invalidateQueries({ queryKey: ['education', userId] });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: EducationFormData = {
      school: formData.get('school') as string,
      degree: formData.get('degree') as string,
      fieldOfStudy: formData.get('fieldOfStudy') as string,
      startDate: new Date(formData.get('startDate') as string),
      endDate: formData.get('current') === 'true' ? undefined : new Date(formData.get('endDate') as string),
      current: formData.get('current') === 'true',
      description: formData.get('description') as string,
      activities: formData.get('activities') as string,
      grade: formData.get('grade') as string,
    };

    if (editingEducation) {
      updateMutation.mutate({ id: editingEducation._id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  if (isLoading) {
    return <div className="animate-pulse">Loading education...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Education</h2>
        {isOwnProfile && (
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add education
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {education.map((edu) => (
          <Card key={edu._id}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-gray-900">{edu.school}</h3>
                  <div className="mt-1 space-y-1">
                    {(edu.degree || edu.fieldOfStudy) && (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">{edu.degree}</span>
                        {edu.fieldOfStudy && (
                          <span className="text-gray-500">{edu.degree ? ` · ${edu.fieldOfStudy}` : edu.fieldOfStudy}</span>
                        )}
                      </div>
                    )}
                    <div className="text-sm text-gray-500">
                      {format(new Date(edu.startDate), 'MMM yyyy')} -{' '}
                      {edu.current ? 'Present' : format(new Date(edu.endDate!), 'MMM yyyy')}
                    </div>
                    {edu.grade && (
                      <div className="text-sm text-gray-500">
                        Grade: {edu.grade}
                      </div>
                    )}
                  </div>
                  {edu.description && (
                    <p className="mt-3 text-sm text-gray-600 whitespace-pre-line">{edu.description}</p>
                  )}
                  {edu.activities && (
                    <div className="mt-3">
                      <h4 className="text-sm font-medium text-gray-900">Activities and societies</h4>
                      <p className="mt-1 text-sm text-gray-600 whitespace-pre-line">{edu.activities}</p>
                    </div>
                  )}
                </div>
                {isOwnProfile && (
                  <div className="flex gap-1 ml-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingEducation(edu)}
                      className="h-8 w-8 text-gray-500 hover:text-gray-700"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(edu._id)}
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

        {education.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            No education added yet.
          </div>
        )}
      </div>

      <Dialog open={isAddModalOpen || !!editingEducation} onOpenChange={(open) => {
        if (!open) {
          setIsAddModalOpen(false);
          setEditingEducation(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingEducation ? 'Edit Education' : 'Add Education'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">School</label>
              <Input
                name="school"
                defaultValue={editingEducation?.school}
                required
                placeholder="e.g. Stanford University"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Degree</label>
              <Input
                name="degree"
                defaultValue={editingEducation?.degree}
                placeholder="e.g. Bachelor of Science"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Field of Study</label>
              <Input
                name="fieldOfStudy"
                defaultValue={editingEducation?.fieldOfStudy}
                placeholder="e.g. Computer Science"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium">Start Date</label>
                <Input
                  type="date"
                  name="startDate"
                  defaultValue={editingEducation?.startDate?.split('T')[0]}
                  required
                />
              </div>
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium">End Date</label>
                <Input
                  type="date"
                  name="endDate"
                  defaultValue={editingEducation?.endDate?.split('T')[0]}
                  disabled={editingEducation?.current}
                  required={!editingEducation?.current}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                name="current"
                id="current"
                value="true"
                defaultChecked={editingEducation?.current}
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
              <label htmlFor="current" className="text-sm">I'm currently studying here</label>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Grade</label>
              <Input
                name="grade"
                defaultValue={editingEducation?.grade}
                placeholder="e.g. 3.8 GPA"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                name="description"
                defaultValue={editingEducation?.description}
                placeholder="Describe your studies and achievements..."
                className="h-24"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Activities and Societies</label>
              <Textarea
                name="activities"
                defaultValue={editingEducation?.activities}
                placeholder="List any clubs, organizations, sports teams, etc..."
                className="h-24"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingEducation(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingEducation ? 'Save Changes' : 'Add Education'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
} 