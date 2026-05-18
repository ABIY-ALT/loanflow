
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Edit, AlertTriangle, Users, ArrowLeft, ShieldAlert, Save, Search, X, MoreVertical, RefreshCw, Copy, UserCheck, UserX } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { PERMISSIONS } from '@/lib/permissions';
import { getUsersForAssignment, getAssignableData, updateUserAssignments, resetUserPasswordAction, toggleUserStatusAction, type UserForAssignment, type AssignableData, type UserAssignmentUpdatePayload } from './actions';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const ITEMS_PER_PAGE = 10;

const CopyableToast = ({ password, onCopy }: { password: string, onCopy: () => void }) => {
  return (
    <div className="flex items-center space-x-2">
      <Input
        readOnly
        value={password}
        className="h-8 flex-grow bg-muted/50 border-border"
      />
      <Button variant="outline" size="sm" onClick={onCopy} className="h-8">
        <Copy className="h-4 w-4 mr-2" />
        Copy
      </Button>
    </div>
  );
};


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
  
  const [actionToConfirm, setActionToConfirm] = useState<{ action: 'reset' | 'activate' | 'deactivate'; user: UserForAssignment; } | null>(null);

  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null | undefined>(undefined);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null | undefined>(undefined);
  const [selectedCustomRoleId, setSelectedCustomRoleId] = useState<string | null | undefined>(undefined);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [districtFilter, setDistrictFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const canManageAssignments = currentUser?.permissions.includes(PERMISSIONS.MANAGE_USERS);

  const fetchPageData = useCallback(async () => {
    if (!canManageAssignments) {
        setIsLoadingData(false);
        return;
    }
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
      setAssignableData(assignableResult.data || { departments: [], districts: [], customRoles: [] });

    } catch (err: any) {
      setError(err.message || "Failed to load page data.");
      setUsers([]);
      setAssignableData({ departments: [], districts: [], customRoles: [] });
      toast({ title: "Error Loading Data", description: err.message, variant: "destructive" });
    } finally {
      setIsLoadingData(false);
    }
  }, [toast, canManageAssignments]);

  useEffect(() => {
    if (!authLoading) {
      fetchPageData();
    }
  }, [authLoading, fetchPageData]);
  
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const searchTermLower = searchTerm.toLowerCase();
      const nameMatch = user.name?.toLowerCase().includes(searchTermLower) || user.email.toLowerCase().includes(searchTermLower) || user.phoneNumber?.includes(searchTerm);
      
      const deptMatch = departmentFilter === 'all' || user.departmentId === departmentFilter || (departmentFilter === 'unassigned' && !user.departmentId);
      const districtMatch = districtFilter === 'all' || user.districtId === districtFilter || (districtFilter === 'unassigned' && !user.districtId);
      const roleMatch = roleFilter === 'all' || user.customRoleId === roleFilter || (roleFilter === 'unassigned' && !user.customRoleId);

      return nameMatch && deptMatch && districtMatch && roleMatch;
    });
  }, [users, searchTerm, departmentFilter, districtFilter, roleFilter]);

  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredUsers, currentPage]);

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, departmentFilter, districtFilter, roleFilter]);


  const handleOpenEditDialog = (userToEdit: UserForAssignment) => {
    if (!canManageAssignments) return;
    setEditingUser(userToEdit);
    setSelectedDepartmentId(userToEdit.departmentId);
    setSelectedDistrictId(userToEdit.districtId);
    setSelectedCustomRoleId(userToEdit.customRoleId);
    setIsFormDialogOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingUser || !canManageAssignments) return;

    setIsSubmitting(true);
    const payload: UserAssignmentUpdatePayload = {};
    
    if (selectedDepartmentId !== editingUser.departmentId) {
        payload.departmentId = selectedDepartmentId === "none" ? null : selectedDepartmentId;
    }
    if (selectedDistrictId !== editingUser.districtId) {
        payload.districtId = selectedDistrictId === "none" ? null : selectedDistrictId;
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
      toast({ title: "Assignments Updated", description: `Assignments for ${result.user.name} saved. Refreshing to apply changes.` });
      setIsFormDialogOpen(false);
      window.location.reload();
    } else {
      toast({ title: "Update Failed", description: result.error || "An unknown error occurred.", variant: "destructive" });
      setIsSubmitting(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!actionToConfirm) return;
    setIsSubmitting(true);

    let result;
    if (actionToConfirm.action === 'reset') {
      result = await resetUserPasswordAction(actionToConfirm.user.id);
      
      if (result.success && result.newPassword) {
        const password = result.newPassword;
        const copyToClipboard = () => {
          navigator.clipboard.writeText(password);
          toast({ title: "Copied!", description: "New password copied to clipboard." });
        };
        toast({
          title: "Success: Password Reset",
          description: <CopyableToast password={password} onCopy={copyToClipboard} />,
          duration: 30000, // Give user time to copy
        });
      }

    } else { // 'activate' or 'deactivate'
      const newStatus = actionToConfirm.action === 'activate';
      result = await toggleUserStatusAction(actionToConfirm.user.id, newStatus);
      if (result.success) {
        toast({ title: "Success", description: result.message });
        fetchPageData(); // Refresh list after status change
      }
    }
    
    if (result && !result.success) {
      toast({ title: "Action Failed", description: result.message, variant: "destructive" });
    }

    setIsSubmitting(false);
    setActionToConfirm(null);
  };
  
  if (authLoading || isLoadingData) {
    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-lg">Verifying access and loading users...</p>
      </div>
    );
  }

  if (!canManageAssignments) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-10rem)] text-center p-4">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-6">You do not have permission to manage user assignments. This requires the '{PERMISSIONS.MANAGE_USERS}' permission.</p>
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
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger><SelectValue placeholder="Filter by Department" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {assignableData?.departments.map(dept => (
                    <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={districtFilter} onValueChange={setDistrictFilter}>
                <SelectTrigger><SelectValue placeholder="Filter by District" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Districts</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {assignableData?.districts.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger><SelectValue placeholder="Filter by Role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                   <SelectItem value="unassigned">Unassigned</SelectItem>
                  {assignableData?.customRoles.map(role => (
                    <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
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
          {!isLoadingData && !error && (
            <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email / Phone</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>District</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                   {paginatedUsers.length === 0 ? (
                     <TableRow>
                        <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                            No users found matching your criteria.
                        </TableCell>
                    </TableRow>
                   ) : paginatedUsers.map((user) => (
                    <TableRow key={user.id} className={cn(!user.isActive && "bg-muted/50 text-muted-foreground")}>
                      <TableCell>
                        {user.isActive ? (
                            <Badge className="bg-green-600 hover:bg-green-700">Active</Badge>
                        ) : (
                            <Badge variant="destructive">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>
                          <div>{user.email}</div>
                          <div className="text-xs">{user.phoneNumber || 'No phone'}</div>
                      </TableCell>
                      <TableCell>
                        {user.departmentName ? <Badge variant="outline">{user.departmentName}</Badge> : <span className="text-xs">N/A</span>}
                      </TableCell>
                      <TableCell>
                        {user.districtName ? <Badge variant="outline">{user.districtName}</Badge> : <span className="text-xs">N/A</span>}
                      </TableCell>
                      <TableCell>
                        {user.customRoleName ? <Badge>{user.customRoleName}</Badge> : <span className="text-xs">N/A</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" disabled={isSubmitting}>
                                    <MoreVertical className="h-4 w-4" />
                                    <span className="sr-only">User Actions</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleOpenEditDialog(user)}>
                                    <Edit className="mr-2 h-4 w-4"/>
                                    <span>Edit Assignments</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setActionToConfirm({ action: 'reset', user })}>
                                    <RefreshCw className="mr-2 h-4 w-4"/>
                                    <span>Reset Password</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {user.isActive ? (
                                     <DropdownMenuItem 
                                        className="text-destructive"
                                        onClick={() => setActionToConfirm({ action: 'deactivate', user })}
                                        disabled={user.email === currentUser?.email}
                                    >
                                        <UserX className="mr-2 h-4 w-4"/>
                                        <span>Deactivate User</span>
                                    </DropdownMenuItem>
                                ) : (
                                    <DropdownMenuItem 
                                        className="text-green-600"
                                        onClick={() => setActionToConfirm({ action: 'activate', user })}
                                    >
                                        <UserCheck className="mr-2 h-4 w-4"/>
                                        <span>Activate User</span>
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            </>
          )}
        </CardContent>
         {totalPages > 1 && (
          <CardFooter className="flex items-center justify-between border-t pt-4">
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                >Previous</Button>
                <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                >Next</Button>
              </div>
          </CardFooter>
        )}
      </Card>

      {editingUser && assignableData && (
        <Dialog open={isFormDialogOpen} onOpenChange={(isOpen) => { if (!isSubmitting) { setIsFormDialogOpen(isOpen); if(!isOpen) setEditingUser(null); } }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Assignments for {editingUser.name}</DialogTitle>
              <DialogDescription>
                Modify department, district, and role for this user.
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
                  <Label htmlFor="district-select" className="block text-sm font-medium mb-1">District</Label>
                  <Select
                    value={selectedDistrictId || "none"}
                    onValueChange={(value) => setSelectedDistrictId(value === "none" ? null : value)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="district-select">
                      <SelectValue placeholder="Select district" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Unassign)</SelectItem>
                      {assignableData.districts.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    District assignment controls which district cases this user can see/work.
                  </p>
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

      {actionToConfirm && (
        <AlertDialog open={!!actionToConfirm} onOpenChange={() => setActionToConfirm(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        {actionToConfirm.action === 'reset' 
                            ? `This will reset the password for ${actionToConfirm.user.name}. They will be forced to change it upon their next login.`
                            : `This will ${actionToConfirm.action} the user ${actionToConfirm.user.name}.`
                        }
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setActionToConfirm(null)} disabled={isSubmitting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={handleConfirmAction}
                        disabled={isSubmitting}
                        className={cn(actionToConfirm.action === 'deactivate' && "bg-destructive hover:bg-destructive/90 text-destructive-foreground")}
                    >
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                        Confirm {actionToConfirm.action}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
