
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { getDepartments, addDepartment, deleteDepartment as deleteDepartmentService } from '@/services/loan-service-prisma';
import { Loader2, PlusCircle, Trash2, AlertTriangle, Building, ArrowLeft, ShieldAlert } from 'lucide-react';
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
import { PERMISSIONS } from '@/lib/permissions'; // Import PERMISSIONS

interface DepartmentItem {
  id: string;
  name: string;
}

export default function ManageDepartmentsPage() {
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const canManageDepartments = currentUser?.permissions.includes(PERMISSIONS.MANAGE_SETTINGS_DEPARTMENTS);

  const fetchDepartmentsCallback = useCallback(async () => {
    if (!canManageDepartments) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await getDepartments();
      if (result.error) {
        setError(result.error);
        setDepartments([]);
      } else if (result.departments) {
        setDepartments(result.departments);
      } else {
        setError("No department data received.");
        setDepartments([]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch departments.");
      setDepartments([]);
    } finally {
      setIsLoading(false);
    }
  }, [canManageDepartments]);

  useEffect(() => {
    if (!authLoading) {
        fetchDepartmentsCallback();
    }
  }, [fetchDepartmentsCallback, authLoading, canManageDepartments]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(departments.length / pageSize));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [departments.length, currentPage, pageSize]);

  const handleAddDepartment = async () => {
    if (!canManageDepartments) return;
    if (!newDepartmentName.trim()) {
      toast({ title: "Validation Error", description: "Department name cannot be empty.", variant: "destructive" });
      return;
    }
    if (departments.some(dept => dept.name.toLowerCase() === newDepartmentName.trim().toLowerCase())) {
      toast({ title: "Validation Error", description: `Department "${newDepartmentName.trim()}" already exists.`, variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
        const result = await addDepartment(newDepartmentName.trim());
        if (result.error || !result.id) {
          toast({ title: "Error Adding Department", description: result.error || "Failed to add department.", variant: "destructive", duration: 9000 });
        } else {
          toast({ title: "Success", description: `Department "${newDepartmentName.trim()}" added.` });
          setNewDepartmentName('');
          await fetchDepartmentsCallback();
        }
    } catch (error: any) {
        toast({ title: "Action Failed", description: `Error: ${error.message || "Unexpected error"}`, variant: "destructive", duration: 9000 });
    } finally {
        setIsSaving(false);
    }
  };

  const handleDeleteDepartment = async (departmentId: string, departmentName: string) => {
    if (!canManageDepartments) return;
    setIsSaving(true);
    try {
        const result = await deleteDepartmentService(departmentId);
        if (result.error) {
          toast({ title: "Error Deleting Department", description: result.error || `Failed to delete department "${departmentName}".`, variant: "destructive", duration: 9000 });
        } else {
          toast({ title: "Success", description: `Department "${departmentName}" deleted.` });
          await fetchDepartmentsCallback();
        }
    } catch (error: any) {
        toast({ title: "Action Failed", description: `Error: ${error.message || "Unexpected error"}`, variant: "destructive", duration: 9000 });
    } finally {
        setIsSaving(false);
    }
  };
  
  if (authLoading || isLoading) {
    return (
        <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="ml-3 text-lg">Loading departments...</p>
        </div>
    );
  }

  if (!canManageDepartments) {
    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-10rem)] text-center p-4">
            <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
            <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
            <p className="text-muted-foreground mb-6">You do not have permission to manage departments. This requires the '{PERMISSIONS.MANAGE_SETTINGS_DEPARTMENTS}' permission.</p>
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
            <Building className="mr-3 h-8 w-8 text-primary" />
            Manage Departments
          </h1>
          <p className="text-muted-foreground">
            Define and manage departments used in workflow stages.
          </p>
        </div>
         <Link href="/settings" passHref>
            <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Settings</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add New Department</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-2 items-end">
          <div className="flex-grow w-full sm:w-auto">
            <label htmlFor="new-department-name" className="sr-only">New Department Name</label>
            <Input
              id="new-department-name"
              placeholder="e.g., Origination, Underwriting"
              value={newDepartmentName}
              onChange={(e) => setNewDepartmentName(e.target.value)}
              disabled={isSaving}
              className="text-base"
            />
          </div>
          <Button onClick={handleAddDepartment} disabled={isSaving || !newDepartmentName.trim()} className="w-full sm:w-auto">
            {isSaving && !isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
            Add Department
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Departments ({departments.length})</CardTitle>
          <CardDescription>
            List of currently defined departments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(() => {
            const totalPages = Math.max(1, Math.ceil(departments.length / pageSize));
            const safePage = Math.min(currentPage, totalPages);
            const startIndex = (safePage - 1) * pageSize;
            const endIndex = Math.min(startIndex + pageSize, departments.length);
            const pagedDepartments = departments.slice(startIndex, endIndex);

            return (
              <>
          {isLoading && departments.length === 0 && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-3 text-muted-foreground">Loading departments...</p>
            </div>
          )}
          {!isLoading && error && (
            <div className="text-destructive p-4 border border-destructive/50 rounded-md">
              <AlertTriangle className="inline h-5 w-5 mr-2" />
              Error loading departments: {error}
            </div>
          )}
          {!isLoading && !error && departments.length === 0 && (
            <div className="text-center text-muted-foreground py-10">
              <Building className="mx-auto h-12 w-12 mb-4 text-gray-400" />
              <p className="font-semibold">No departments defined yet.</p>
              <p>Add departments using the form above.</p>
            </div>
          )}
          {!isLoading && !error && departments.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department Name</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedDepartments.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell className="font-medium">{dept.name}</TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" disabled={isSaving}>
                            <Trash2 className="mr-1 h-4 w-4" /> Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. Deleting department "{dept.name}" might affect existing workflow configurations if it&apos;s in use.
                              Ensure no workflow stages or users depend on this department before deleting.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteDepartment(dept.id, dept.name)}
                              disabled={isSaving}
                              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                            >
                              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
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
          )}
          {!isLoading && !error && totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t mt-2">
              <p className="text-sm text-muted-foreground">
                Showing {startIndex + 1}-{endIndex} of {departments.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={safePage <= 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {safePage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={safePage >= totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
              </>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
