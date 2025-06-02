
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { getDepartments, addDepartment, deleteDepartment as deleteDepartmentService } from '@/services/loan-service';
import { Loader2, PlusCircle, Trash2, AlertTriangle, Building } from 'lucide-react';
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
import { ArrowLeft } from 'lucide-react';

interface DepartmentItem {
  id: string;
  name: string;
}

export default function ManageDepartmentsPage() {
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchDepartmentsCallback = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchDepartmentsCallback();
  }, [fetchDepartmentsCallback]);

  const handleAddDepartment = async () => {
    if (!newDepartmentName.trim()) {
      toast({ title: "Validation Error", description: "Department name cannot be empty.", variant: "destructive" });
      return;
    }
    if (departments.some(dept => dept.name.toLowerCase() === newDepartmentName.trim().toLowerCase())) {
      toast({ title: "Validation Error", description: `Department "${newDepartmentName.trim()}" already exists.`, variant: "destructive" });
      return;
    }
    setIsSaving(true);
    const result = await addDepartment(newDepartmentName.trim());
    if (result.error || !result.id) {
      toast({ title: "Error", description: result.error || "Failed to add department.", variant: "destructive" });
    } else {
      toast({ title: "Success", description: `Department "${newDepartmentName.trim()}" added.` });
      setNewDepartmentName('');
      // Refetch or add to local state optimistically
      // For simplicity and consistency with Firestore IDs, refetch:
      await fetchDepartmentsCallback();
    }
    setIsSaving(false);
  };

  const handleDeleteDepartment = async (departmentId: string, departmentName: string) => {
    setIsSaving(true); // Use general saving for delete as well
    // TODO: Add check if department is in use by any workflow stage
    // For now, direct delete
    const result = await deleteDepartmentService(departmentId);
    if (result.error) {
      toast({ title: "Error", description: result.error || `Failed to delete department "${departmentName}".`, variant: "destructive" });
    } else {
      toast({ title: "Success", description: `Department "${departmentName}" deleted.` });
      await fetchDepartmentsCallback();
    }
    setIsSaving(false);
  };


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
          {isLoading && (
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
                {departments.map((dept) => (
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
                              Ensure no workflow stages depend on this department before deleting.
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
        </CardContent>
      </Card>
    </div>
  );
}
