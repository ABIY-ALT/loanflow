
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Edit, AlertTriangle, Users, ArrowLeft, ShieldAlert, Save } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { UserRole as AppUserRoleEnum } from '@/types/loan'; // For built-in roles
import { getUsersForAssignment, getAssignableData, updateUserAssignments, type UserForAssignment, type AssignableData, type UserAssignmentUpdatePayload } from './actions';
import { Badge } from '@/components/ui/badge';


export default function ManageUserAssignmentsPage() {
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const [users, setUsers] = useState<UserForAssignment[]>([]);
  const [assignableData, setAssignableData] = useState<AssignableData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserForAssignment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state for the dialog
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null | undefined>(undefined);
  const [selectedCustomRoleId, setSelectedCustomRoleId] = useState<string | null | undefined>(undefined);

  const fetchPageData = useCallback(async () => {
    setIsLoadingData(true);
    setError(null);
    try {
      const [usersResult, assignableResult] = await Promise.all([
        getUsersForAssignment(),
        getAssignableData(),
      ]);

      if (usersResult.error) throw new Error(usersResult.error);
      setUsers(usersResult.users || []);

      if (assignableResult.error) throw new Error(assignableResult.error);
      setAssignableData(assignableResult.data || { departments: [], customRoles: [] });

    } catch (err: any) {
      setError(err.message || "Failed to load page data.");
      setUsers([]);
      setAssignableData({ departments: [], customRoles: [] });
      toast({ title: "Error Loading Data", description: err.message, variant: "destructive" });
    } finally {
      setIsLoadingData(false);
    }
  }, [toast]);

  useEffect(() => {
    if (currentUser?.role === AppUserRoleEnum.ADMIN) {
      fetchPageData();
    }
  }, [currentUser, fetchPageData]);

  const handleOpenEditDialog = (userToEdit: UserForAssignment) => {
    setEditingUser(userToEdit);
    setSelectedDepartmentId(userToEdit.departmentId);
    setSelectedCustomRoleId(userToEdit.customRoleId);
    setIsFormDialogOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsSubmitting(true);
    const payload: UserAssignmentUpdatePayload = {};
    
    if (selectedDepartmentId !== editingUser.departmentId) {
        payload.departmentId = selectedDepartmentId === "none" ? null : selectedDepartmentId;
    }
    if (selectedCustomRoleId !== editingUser.customRoleId) {
        payload.customRoleId = selectedCustomRoleId === "none" ? null : selectedCustomRoleId;
    }

    if (Object.keys(payload).length === 0) {
        toast({ title: "No Changes", description: "No assignments were modified.", variant: "default" });
        setIsSubmitting(false);
        setIsFormDialogOpen(false);
        return;
    }

    const result = await updateUserAssignments(editingUser.id, payload);

    if (result.success && result.user) {
      toast({ title: "Assignments Updated", description: `Assignments for ${result.user.name} saved successfully.` });
      await fetchPageData(); // Refresh users list
      setIsFormDialogOpen(false);
    } else {
      toast({ title: "Update Failed", description: result.error || "An unknown error occurred.", variant: "destructive" });
    }
    setIsSubmitting(false);
  };
  
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-lg">Verifying access...</p>
      </div>
    );
  }

  if (!currentUser || currentUser.role !== AppUserRoleEnum.ADMIN) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-10rem)] text-center p-4">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-6">You do not have permission to manage user assignments. This feature is for Administrators only.</p>
        <Link href="/settings" passHref>
          <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Settings</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center">
            <Users className="mr-3 h-8 w-8 text-primary" />
            Manage User Assignments
          </h1>
          <p className="text-muted-foreground">
            Assign departments and application-specific roles to users.
          </p>
        </div>
        <Link href="/settings" passHref>
          <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Settings</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users ({users.length})</CardTitle>
          <CardDescription>List of all users. Click Edit to modify their department and role assignments.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingData && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-3 text-muted-foreground">Loading users...</p>
            </div>
          )}
          {!isLoadingData && error && (
            <div className="text-destructive p-4 border border-destructive/50 rounded-md">
              <AlertTriangle className="inline h-5 w-5 mr-2" />
              Error loading users: {error}
            </div>
          )}
          {!isLoadingData && !error && users.length === 0 && (
            <div className="text-center text-muted-foreground py-10">
              <Users className="mx-auto h-12 w-12 mb-4 text-gray-400" />
              <p className="font-semibold">No users found.</p>
              <p>Ensure users are registered in the system.</p>
            </div>
          )}
          {!isLoadingData && !error && users.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        {user.departmentName ? <Badge variant="outline">{user.departmentName}</Badge> : <span className="text-xs text-muted-foreground">N/A</span>}
                      </TableCell>
                      <TableCell>
                        {user.customRoleName ? <Badge>{user.customRoleName}</Badge> : <span className="text-xs text-muted-foreground">N/A</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEditDialog(user)} disabled={isSubmitting}>
                           <Edit className="mr-1 h-3 w-3" /> Edit Assignments
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {editingUser && assignableData && (
        <Dialog open={isFormDialogOpen} onOpenChange={(isOpen) => { if (!isSubmitting) { setIsFormDialogOpen(isOpen); if(!isOpen) setEditingUser(null); } }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Assignments for {editingUser.name}</DialogTitle>
              <DialogDescription>
                Modify department and role for this user.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleFormSubmit}>
              <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                <div>
                  <Label htmlFor="department-select" className="block text-sm font-medium mb-1">Department</Label>
                  <Select
                    value={selectedDepartmentId || "none"}
                    onValueChange={(value) => setSelectedDepartmentId(value === "none" ? null : value)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="department-select">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Unassign)</SelectItem>
                      {assignableData.departments.map(dept => (
                        <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="role-select" className="block text-sm font-medium mb-1">Role</Label>
                  <Select
                    value={selectedCustomRoleId || "none"}
                    onValueChange={(value) => setSelectedCustomRoleId(value === "none" ? null : value)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="role-select">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Unassign)</SelectItem>
                      {assignableData.customRoles.map(cRole => (
                        <SelectItem key={cRole.id} value={cRole.id}>{cRole.name}</SelectItem>
                      ))}
                      {assignableData.customRoles.length === 0 && (
                        <SelectItem value="no-custom-roles" disabled>No roles defined</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="pt-5 mt-2 border-t">
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => {setIsFormDialogOpen(false); setEditingUser(null);}}>Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

