
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getRoles, addRole, deleteRole, updateRole, type AppRole } from '@/services/role-service';
import { ALL_PERMISSIONS, PERMISSION_DESCRIPTIONS, PERMISSION_CATEGORIES, type AppPermission } from '@/lib/permissions';
import { Loader2, PlusCircle, Trash2, AlertTriangle, ShieldAlert, ArrowLeft, Drama, Edit, Save, BadgeCheck, XCircle } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription as ShadDialogDescription, // Aliased to avoid conflicts if any
  DialogFooter,
  DialogHeader,
  DialogTitle as ShadDialogTitle, // Aliased to avoid conflicts if any
  DialogClose,
} from "@/components/ui/dialog";
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { UserRole as AppUserRoleEnum } from '@/types/loan';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';


export default function ManageRolesPage() {
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // State for Add/Edit Dialog
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<AppRole | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<Set<AppPermission>>(new Set());

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

  const resetFormDialog = () => {
    setEditingRole(null);
    setRoleName('');
    setRoleDescription('');
    setSelectedPermissions(new Set());
    setIsFormDialogOpen(false);
  };

  const handleOpenAddDialog = () => {
    resetFormDialog();
    setIsFormDialogOpen(true);
  };

  const handleOpenEditDialog = (role: AppRole) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDescription(role.description || '');
    setSelectedPermissions(new Set(role.permissions));
    setIsFormDialogOpen(true);
  };
  
  const handlePermissionChange = (permission: AppPermission, checked: boolean) => {
    setSelectedPermissions(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(permission);
      } else {
        next.delete(permission);
      }
      return next;
    });
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!roleName.trim()) {
      toast({ title: "Validation Error", description: "Role name cannot be empty.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const permissionsArray = Array.from(selectedPermissions);
    let result;
    if (editingRole) {
      result = await updateRole(editingRole.id, roleName, roleDescription, permissionsArray);
    } else {
      result = await addRole(roleName, roleDescription, permissionsArray);
    }

    if (result.error) {
      toast({ title: `Error ${editingRole ? 'Updating' : 'Adding'} Role`, description: result.error, variant: "destructive" });
    } else {
      toast({ title: `Role ${editingRole ? 'Updated' : 'Added'}`, description: `Role "${result.data?.name}" ${editingRole ? 'updated' : 'created'} successfully.` });
      resetFormDialog();
      await fetchRolesCallback(); 
    }
    setIsSubmitting(false);
  };

  const handleDeleteRole = async (roleId: string, roleNameForToast: string) => {
    setIsDeleting(roleId);
    const result = await deleteRole(roleId);
    if (result.error) {
      toast({ title: "Error Deleting Role", description: result.error, variant: "destructive" });
    } else {
      toast({ title: "Role Deleted", description: `Role "${roleNameForToast}" has been deleted.` });
      await fetchRolesCallback(); 
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
            Define application roles and assign specific permissions to them.
          </p>
        </div>
        <div className="flex gap-2">
            <Link href="/settings" passHref>
              <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Settings</Button>
            </Link>
            <Button onClick={handleOpenAddDialog}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Role
            </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Existing Roles ({roles.length})</CardTitle>
          <CardDescription>List of currently defined roles and their assigned permissions.</CardDescription>
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
              <p>Click "Add New Role" to get started.</p>
            </div>
          )}
          {!isLoadingData && !error && roles.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">{role.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{role.description || 'N/A'}</TableCell>
                      <TableCell className="max-w-sm">
                        {role.permissions.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {role.permissions.slice(0, 3).map(p => <Badge key={p} variant="secondary" className="text-xs">{PERMISSION_DESCRIPTIONS[p as AppPermission]?.split('.')[0] || p}</Badge>)}
                            {role.permissions.length > 3 && <Badge variant="outline" className="text-xs">+{role.permissions.length - 3} more</Badge>}
                          </div>
                        ) : (
                          <Badge variant="outline">No Permissions</Badge>
                        )}
                      </TableCell>
                      <TableCell>{format(new Date(role.createdAt), 'PPp')}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEditDialog(role)} disabled={isSubmitting || !!isDeleting}>
                           <Edit className="mr-1 h-3 w-3" /> Edit
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" disabled={isDeleting === role.id || isSubmitting}>
                              {isDeleting === role.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1 h-3 w-3" />}
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. Deleting role "{role.name}" will permanently remove it.
                                Ensure no users are currently assigned this role.
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

      {/* Add/Edit Role Dialog */}
      <Dialog open={isFormDialogOpen} onOpenChange={(isOpen) => { if (!isSubmitting) { setIsFormDialogOpen(isOpen); if (!isOpen) resetFormDialog(); } }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <ShadDialogTitle>{editingRole ? 'Edit Role' : 'Add New Role'}</ShadDialogTitle>
            <ShadDialogDescription>
              {editingRole ? `Update the details for "${editingRole.name}".` : 'Define a new role and assign its permissions.'}
            </ShadDialogDescription>
          </DialogHeader>
          <form onSubmit={handleFormSubmit}>
            <ScrollArea className="max-h-[60vh] p-1 pr-3"> {/* ScrollArea added here */}
              <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="role-name-dialog" className="block text-sm font-medium mb-1">Role Name</Label>
                    <Input
                      id="role-name-dialog"
                      placeholder="e.g., Loan Reviewer"
                      value={roleName}
                      onChange={(e) => setRoleName(e.target.value)}
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="role-description-dialog" className="block text-sm font-medium mb-1">Description (Optional)</Label>
                    <Textarea
                      id="role-description-dialog"
                      placeholder="Briefly describe this role's purpose"
                      value={roleDescription}
                      onChange={(e) => setRoleDescription(e.target.value)}
                      disabled={isSubmitting}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-md font-semibold">Assign Permissions</h4>
                    {PERMISSION_CATEGORIES.map(category => (
                      <div key={category.name} className="space-y-2 p-3 border rounded-md bg-muted/30">
                        <h5 className="text-sm font-medium text-primary">{category.name}</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                          {category.permissions.map(permissionKey => (
                             <div key={permissionKey} className="flex items-center space-x-2">
                               <Checkbox
                                 id={`perm-${permissionKey}`}
                                 checked={selectedPermissions.has(permissionKey)}
                                 onCheckedChange={(checked) => handlePermissionChange(permissionKey, !!checked)}
                                 disabled={isSubmitting}
                               />
                               <Label htmlFor={`perm-${permissionKey}`} className="text-sm font-normal cursor-pointer leading-tight">
                                 {PERMISSION_DESCRIPTIONS[permissionKey] || permissionKey}
                               </Label>
                             </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
              </div>
            </ScrollArea>
            <DialogFooter className="pt-5">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSubmitting} onClick={resetFormDialog}>Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting || !roleName.trim()}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (editingRole ? <Save className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />)}
                {editingRole ? 'Save Changes' : 'Add Role'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
    