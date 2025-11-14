

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { getDistricts, addDistrict, deleteDistrict, getBranches, addBranch, deleteBranch, updateDistrict, updateBranch } from '@/services/branch-service';
import { Loader2, PlusCircle, Trash2, Edit, Save, AlertTriangle, Building, ArrowLeft, ShieldAlert, Map } from 'lucide-react';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { PERMISSIONS } from '@/lib/permissions';
import { Label } from '@/components/ui/label';

interface DistrictItem { id: string; name: string; }
interface BranchItem { id: string; name: string; districtName: string; }
type EditableItem = { id: string; name: string; type: 'district' | 'branch' };

export default function ManageBranchesPage() {
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const [districts, setDistricts] = useState<DistrictItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [newDistrictName, setNewDistrictName] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [selectedDistrictId, setSelectedDistrictId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EditableItem | null>(null);
  const [editingName, setEditingName] = useState('');

  const canManageBranches = currentUser?.permissions.includes(PERMISSIONS.MANAGE_SETTINGS_BRANCHES);

  const fetchData = useCallback(async (isInitialLoad = false) => {
    if (!canManageBranches) {
        setIsLoading(false);
        return;
    };
    if (isInitialLoad) setIsLoading(true);
    setError(null);
    try {
      const [districtsResult, branchesResult] = await Promise.all([getDistricts(), getBranches()]);
      if (districtsResult.error) throw new Error(districtsResult.error);
      if (branchesResult.error) throw new Error(branchesResult.error);
      
      const fetchedDistricts = districtsResult.districts || [];
      setDistricts(fetchedDistricts);
      setBranches(branchesResult.branches || []);

      if (isInitialLoad && fetchedDistricts.length > 0 && !selectedDistrictId) {
        setSelectedDistrictId(fetchedDistricts[0].id);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch data.");
    } finally {
      if (isInitialLoad) setIsLoading(false);
    }
  }, [canManageBranches, selectedDistrictId]);

  useEffect(() => {
    if (!authLoading) {
      fetchData(true);
    }
  }, [authLoading, canManageBranches]);

  const handleOpenEditDialog = (item: EditableItem) => {
    setEditingItem(item);
    setEditingName(item.name);
    setIsEditDialogOpen(true);
  };

  const handleUpdateItem = async () => {
    if (!editingItem || !editingName.trim()) {
      toast({ title: "Validation Error", description: "Name cannot be empty.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    const updateAction = editingItem.type === 'district' ? updateDistrict : updateBranch;
    const result = await updateAction(editingItem.id, editingName.trim());

    if (result.error) {
      toast({ title: `Error Updating ${editingItem.type}`, description: result.error, variant: "destructive" });
    } else {
      toast({ title: "Success", description: `${editingItem.type.charAt(0).toUpperCase() + editingItem.type.slice(1)} updated.` });
      setIsEditDialogOpen(false);
      setEditingItem(null);
      await fetchData();
    }
    setIsSaving(false);
  };

  const handleAddDistrict = async () => {
    if (!newDistrictName.trim()) return toast({ title: "Validation Error", description: "District name cannot be empty.", variant: "destructive" });
    setIsSaving(true);
    const result = await addDistrict(newDistrictName.trim());
    if (result.error) toast({ title: "Error Adding District", description: result.error, variant: "destructive" });
    else {
      toast({ title: "Success", description: `District "${newDistrictName.trim()}" added.` });
      setNewDistrictName('');
      await fetchData();
    }
    setIsSaving(false);
  };

  const handleAddBranch = async () => {
    if (!newBranchName.trim()) return toast({ title: "Validation Error", description: "Branch name cannot be empty.", variant: "destructive" });
    if (!selectedDistrictId) return toast({ title: "Validation Error", description: "Please select a district.", variant: "destructive" });
    setIsSaving(true);
    const result = await addBranch(newBranchName.trim(), selectedDistrictId);
    if (result.error) toast({ title: "Error Adding Branch", description: result.error, variant: "destructive" });
    else {
      toast({ title: "Success", description: `Branch "${newBranchName.trim()}" added.` });
      setNewBranchName('');
      await fetchData();
    }
    setIsSaving(false);
  };
  
  const handleDelete = async (type: 'district' | 'branch', id: string, name: string) => {
    setIsSaving(true);
    const deleteAction = type === 'district' ? deleteDistrict : deleteBranch;
    const result = await deleteAction(id);
    if (result.error) {
        toast({ title: `Error Deleting ${type}`, description: result.error, variant: "destructive", duration: 7000 });
    } else {
        toast({ title: "Success", description: `${type.charAt(0).toUpperCase() + type.slice(1)} "${name}" deleted.` });
        await fetchData();
    }
    setIsSaving(false);
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-lg">Loading branch & district data...</p>
      </div>
    );
  }

  if (!canManageBranches) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-10rem)] text-center p-4">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-6">You do not have permission to manage branches and districts.</p>
        <Link href="/settings" passHref><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Settings</Button></Link>
      </div>
    );
  }
  
  if (error) {
     return <div className="text-destructive text-center p-4">{error}</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center"><Map className="mr-3 h-8 w-8 text-primary" />Manage Branches & Districts</h1>
          <p className="text-muted-foreground">Define and manage organizational districts and their branches.</p>
        </div>
        <Link href="/settings" passHref><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Settings</Button></Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Add New District</CardTitle></CardHeader>
          <CardContent className="flex gap-2 items-end">
            <div className="flex-grow"><label htmlFor="new-district-name" className="sr-only">New District Name</label><Input id="new-district-name" placeholder="e.g., North Region" value={newDistrictName} onChange={(e) => setNewDistrictName(e.target.value)} disabled={isSaving} /></div>
            <Button onClick={handleAddDistrict} disabled={isSaving || !newDistrictName.trim()}><PlusCircle className="mr-2 h-4 w-4" /> Add</Button>
          </CardContent>
          <CardHeader><CardTitle>Existing Districts ({districts.length})</CardTitle></CardHeader>
          <CardContent><Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {districts.map((d) => (
                <TableRow key={d.id}><TableCell>{d.name}</TableCell><TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => handleOpenEditDialog({id: d.id, name: d.name, type: 'district'})} disabled={isSaving}><Edit className="mr-1 h-4 w-4" /> Edit</Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" disabled={isSaving}><Trash2 className="mr-1 h-4 w-4" /> Delete</Button></AlertDialogTrigger>
                    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete District "{d.name}"?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone and will also delete all branches within this district.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete('district', d.id, d.name)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Confirm Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                  </AlertDialog>
                </TableCell></TableRow>
              ))}
            </TableBody>
          </Table></CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Add New Branch</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex gap-2 items-end">
                <div className="flex-grow"><Label htmlFor="new-branch-name">Branch Name</Label><Input id="new-branch-name" placeholder="e.g., Central Branch" value={newBranchName} onChange={(e) => setNewBranchName(e.target.value)} disabled={isSaving || districts.length === 0} className="mt-1" /></div>
            </div>
            <div className="flex-grow"><Label htmlFor="district-select">In District</Label>
                <Select value={selectedDistrictId} onValueChange={setSelectedDistrictId} disabled={isSaving || districts.length === 0}><SelectTrigger id="district-select" className="mt-1"><SelectValue placeholder="Select a district" /></SelectTrigger>
                    <SelectContent>{districts.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}</SelectContent>
                </Select>
            </div>
            <Button onClick={handleAddBranch} disabled={isSaving || !newBranchName.trim() || !selectedDistrictId}><PlusCircle className="mr-2 h-4 w-4" /> Add Branch</Button>
          </CardContent>
          <CardHeader><CardTitle>Existing Branches ({branches.length})</CardTitle></CardHeader>
          <CardContent><Table>
            <TableHeader><TableRow><TableHead>Branch Name</TableHead><TableHead>District</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
                {branches.map((b) => (
                    <TableRow key={b.id}><TableCell>{b.name}</TableCell><TableCell>{b.districtName}</TableCell><TableCell className="text-right">
                         <Button variant="ghost" size="sm" onClick={() => handleOpenEditDialog({id: b.id, name: b.name, type: 'branch'})} disabled={isSaving}><Edit className="mr-1 h-4 w-4" /> Edit</Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" disabled={isSaving}><Trash2 className="mr-1 h-4 w-4" /> Delete</Button></AlertDialogTrigger>
                            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Branch "{b.name}"?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete('branch', b.id, b.name)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Confirm Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                        </AlertDialog>
                    </TableCell></TableRow>
                ))}
            </TableBody>
          </Table></CardContent>
        </Card>
      </div>

       <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editingItem?.type}</DialogTitle>
            <DialogDescription>
              Update the name for &quot;{editingItem?.name}&quot;.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Label htmlFor="editing-name">New Name</Label>
            <Input
              id="editing-name"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              disabled={isSaving}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
            <Button type="button" onClick={handleUpdateItem} disabled={isSaving || !editingName.trim()}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
