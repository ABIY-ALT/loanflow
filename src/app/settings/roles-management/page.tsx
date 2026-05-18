
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
import { PERMISSION_DESCRIPTIONS, PERMISSION_CATEGORIES, resolvePermissionEntry, resolvePermissionLabel, type AppPermission, PERMISSIONS } from '@/lib/permissions';
import { Loader2, PlusCircle, Trash2, AlertTriangle, ShieldAlert, ArrowLeft, Drama, Edit, Save, BadgeCheck } from 'lucide-react';
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
  DialogDescription as ShadDialogDescription, 
  DialogHeader as ShadDialogHeaderCustom,
  DialogFooter,
  DialogTitle as ShadDialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
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

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<AppRole | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<Set<AppPermission>>(new Set());

  const canManageRoles = currentUser?.permissions.includes(PERMISSIONS.MANAGE_SETTINGS_ROLES);

  const fetchRolesCallback = useCallback(async () => {
    if (!canManageRoles) {
      setIsLoadingData(false);
      return;
    }
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
  }, [toast, canManageRoles]);

  useEffect(() => {
    if (!authLoading) {
      fetchRolesCallback();
    }
  }, [authLoading, fetchRolesCallback]);

  const resetFormDialog = () => {
    setEditingRole(null);
    setRoleName('');
    setRoleDescription('');
    setSelectedPermissions(new Set());
    setIsFormDialogOpen(false);
  };

  const handleOpenAddDialog = () => {
    if (!canManageRoles) return;
    resetFormDialog();
    setIsFormDialogOpen(true);
  };

  const handleOpenEditDialog = (role: AppRole) => {
    if (!canManageRoles) return;
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
    if (!canManageRoles) return;
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
      toast({ title: `Role ${editingRole ? 'Updated' : 'Added'}`, description: `Role "${result.data?.name}" has been saved. The page will now reload to apply any permission changes.`, duration: 7000 });
      resetFormDialog();
      // Force a reload to reflect permission changes for the current user if their own role was changed
      setTimeout(() => window.location.reload(), 2000);
    }
    setIsSubmitting(false);
  };

  const handleDeleteRole = async (roleId: string, roleNameForToast: string) => {
    if (!canManageRoles) return;
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
  
  if (authLoading || isLoadingData) {
    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-lg">Verifying access...</p>
      </div>
    );
  }

  if (!canManageRoles) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-10rem)] text-center p-4">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-6">You do not have permission to manage roles. This requires the '{PERMISSIONS.MANAGE_SETTINGS_ROLES}' permission.</p>
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

      <Dialog open={isFormDialogOpen} onOpenChange={(isOpen) => { if (!isSubmitting) { setIsFormDialogOpen(isOpen); if (!isOpen) resetFormDialog(); } }}>
        <DialogContent className="sm:max-w-2xl h-[90vh] flex flex-col">
          <ShadDialogHeaderCustom>
            <ShadDialogTitle>{editingRole ? 'Edit Role' : 'Add New Role'}</ShadDialogTitle>
            <ShadDialogDescription>
              {editingRole ? `Update the details for "${editingRole.name}".` : 'Define a new role and assign its permissions.'}
            </ShadDialogDescription>
          </ShadDialogHeaderCustom>
          <form id="roleDialogForm" onSubmit={handleFormSubmit} className="flex-grow overflow-y-auto pr-2 space-y-4 py-4">
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
            
            <div className="space-y-2 pt-2">
              <h4 className="text-md font-semibold">Assign Permissions</h4>
              <ScrollArea className="rounded-md border h-96">
                <div className="p-4 space-y-3">
                  {PERMISSION_CATEGORIES.map(category => (
                    <div key={category.name} className="space-y-2 p-3 border rounded-md bg-muted/30">
                      <h5 className="text-sm font-medium text-primary">{category.name}</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                        {category.permissions.map((entry, index) => {
                          const permissionKey = resolvePermissionEntry(entry);
                          const label = resolvePermissionLabel(entry);
                          return (
                           <div key={`${permissionKey}-${category.name}-${index}`} className="flex items-center space-x-2">
                             <Checkbox
                               id={`perm-${category.name}-${index}`}
                               checked={selectedPermissions.has(permissionKey)}
                               onCheckedChange={(checked) => handlePermissionChange(permissionKey, !!checked)}
                               disabled={isSubmitting}
                             />
                             <Label htmlFor={`perm-${category.name}-${index}`} className="text-sm font-normal cursor-pointer leading-tight">
                               {label}
                             </Label>
                           </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </form>
          <DialogFooter className="mt-auto pt-4 border-t">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSubmitting} onClick={resetFormDialog}>Cancel</Button>
            </DialogClose>
            <Button type="submit" form="roleDialogForm" disabled={isSubmitting || !roleName.trim()}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (editingRole ? <Save className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />)}
              {editingRole ? 'Save Changes' : 'Add Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
