
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { getRoles, addRole, deleteRole, type AppRole } from '@/services/role-service';
import { Loader2, PlusCircle, Trash2, AlertTriangle, ShieldAlert, ArrowLeft, Drama } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { UserRole as AppUserRoleEnum } from '@/types/loan'; // Using existing enum for permission check
import { format } from 'date-fns';

export default function ManageRolesPage() {
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null); // Store ID of role being deleted
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchRolesCallback = useCallback(async () => {
    setIsLoadingData(true);
    setError(null);
    const result = await getRoles();
    if (result.error) {
      setError(result.error);
      setRoles([]);
      toast({ title: "Error Loading Roles", description: result.error, variant: "destructive" });
    } else {
      setRoles(result.data || []);
    }
    setIsLoadingData(false);
  }, [toast]);

  useEffect(() => {
    if (currentUser?.role === AppUserRoleEnum.ADMIN) {
      fetchRolesCallback();
    }
  }, [currentUser, fetchRolesCallback]);

  const handleAddRole = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newRoleName.trim()) {
      toast({ title: "Validation Error", description: "Role name cannot be empty.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const result = await addRole(newRoleName, newRoleDescription);
    if (result.error) {
      toast({ title: "Error Adding Role", description: result.error, variant: "destructive" });
    } else {
      toast({ title: "Role Added", description: `Role "${result.data?.name}" created successfully.` });
      setNewRoleName('');
      setNewRoleDescription('');
      await fetchRolesCallback(); // Refresh list
    }
    setIsSubmitting(false);
  };

  const handleDeleteRole = async (roleId: string, roleName: string) => {
    setIsDeleting(roleId);
    const result = await deleteRole(roleId);
    if (result.error) {
      toast({ title: "Error Deleting Role", description: result.error, variant: "destructive" });
    } else {
      toast({ title: "Role Deleted", description: `Role "${roleName}" has been deleted.` });
      await fetchRolesCallback(); // Refresh list
    }
    setIsDeleting(null);
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
        <p className="text-muted-foreground mb-6">You do not have permission to manage roles. This feature is for Administrators only.</p>
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
            <Drama className="mr-3 h-8 w-8 text-primary" />
            Role Management
          </h1>
          <p className="text-muted-foreground">
            Define application roles. Associating these roles with users and defining permissions will be a subsequent step.
          </p>
        </div>
        <Link href="/settings" passHref>
          <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Settings</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add New Role</CardTitle>
          <CardDescription>Create a new role by providing a name and an optional description.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddRole} className="space-y-4">
            <div>
              <label htmlFor="new-role-name" className="block text-sm font-medium mb-1">Role Name (e.g., Senior Loan Officer)</label>
              <Input
                id="new-role-name"
                placeholder="Enter role name"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
            <div>
              <label htmlFor="new-role-description" className="block text-sm font-medium mb-1">Description (Optional)</label>
              <Textarea
                id="new-role-description"
                placeholder="Briefly describe this role's purpose"
                value={newRoleDescription}
                onChange={(e) => setNewRoleDescription(e.target.value)}
                disabled={isSubmitting}
                rows={3}
              />
            </div>
            <Button type="submit" disabled={isSubmitting || !newRoleName.trim()}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
              Add Role
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Roles ({roles.length})</CardTitle>
          <CardDescription>List of currently defined roles in the system.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingData && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-3 text-muted-foreground">Loading roles...</p>
            </div>
          )}
          {!isLoadingData && error && (
            <div className="text-destructive p-4 border border-destructive/50 rounded-md">
              <AlertTriangle className="inline h-5 w-5 mr-2" />
              Error loading roles: {error}
            </div>
          )}
          {!isLoadingData && !error && roles.length === 0 && (
            <div className="text-center text-muted-foreground py-10">
              <Drama className="mx-auto h-12 w-12 mb-4 text-gray-400" />
              <p className="font-semibold">No roles defined yet.</p>
              <p>Add roles using the form above to get started.</p>
            </div>
          )}
          {!isLoadingData && !error && roles.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">{role.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{role.description || 'N/A'}</TableCell>
                      <TableCell>{format(new Date(role.createdAt), 'PPp')}</TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" disabled={isDeleting === role.id}>
                              {isDeleting === role.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1 h-4 w-4" />}
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. Deleting role "{role.name}" will permanently remove it.
                                If this role is currently assigned to users or has permissions tied to it (in future implementations), those associations might be affected.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel disabled={isDeleting === role.id}>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteRole(role.id, role.name)}
                                disabled={isDeleting === role.id}
                                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                              >
                                {isDeleting === role.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                Confirm Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
