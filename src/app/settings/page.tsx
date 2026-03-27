
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  PlusCircle, 
  Trash2, 
  Save, 
  Clock, 
  GripVertical, 
  Users, 
  Edit, 
  ShieldCheck, 
  ShieldOff, 
  Loader2, 
  Briefcase, 
  Network, 
  UserCog, 
  ChevronDown,
  ArrowRight,
  Settings2,
  ListTree,
  Database,
  Eye,
  EyeOff,
  ChevronRight,
  CheckCircle2,
  Workflow
} from 'lucide-react';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { WorkflowDefinition, WorkflowVersion, WorkflowStageDefinition, Department, DocumentRequirement, Sector, RequestType } from '@/types/loan';
import { DocumentRequirementType } from '@/types/loan';
import { PERMISSIONS } from '@/lib/permissions';
import { getWorkflowDefinitions, saveWorkflowDefinitions, getDepartments } from '@/services/loan-service-prisma';
import { getSectors, addSector, deleteSector, updateSector, getRequestTypes, addRequestType, deleteRequestType, updateRequestType } from '@/services/sector-and-request-type-service';
import { getRoles, type AppRole } from '@/services/role-service';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const { toast } = useToast();
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSavingAll, setIsSavingAll] = useState(false);
  
  // Data State
  const [workflowDefinitions, setWorkflowDefinitions] = useState<WorkflowDefinition[]>([]);
  const [departments, setDepartments] = useState<{id: string, name: Department}[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  
  // UI State
  const [expandedPaths, setExpandedPaths] = useState<string[]>([]);
  const [newSectorName, setNewSectorName] = useState('');
  const [newRequestTypeName, setNewRequestTypeName] = useState('');
  
  // Form State for New Workflow
  const [newWfForm, setNewWfForm] = useState({
    name: '',
    departmentId: '',
    parentSectorId: '',
    childSectorId: '',
    description: '',
    insertAfterId: 'none'
  });

  const canManageWorkflows = currentUser?.permissions.includes(PERMISSIONS.MANAGE_SETTINGS_WORKFLOWS);

  const fetchData = useCallback(async () => {
    if (!canManageWorkflows) { setIsLoadingData(false); return; }
    setIsLoadingData(true);
    try {
      const [wf, depts, sect, rTypes, appRoles] = await Promise.all([
        getWorkflowDefinitions(), getDepartments(), getSectors(), getRequestTypes(), getRoles()
      ]);
      setWorkflowDefinitions(wf.workflows || []);
      setDepartments(depts.departments || []);
      setSectors(sect.sectors || []);
      setRequestTypes(rTypes.requestTypes as RequestType[] || []);
      setRoles(appRoles.data || []);
      
      // Expand all by default
      setExpandedPaths(sect.sectors?.filter(s => !s.parentId).map(s => `path-${s.id}`) || []);
    } catch (e) { 
      console.error(e); 
    } finally { 
      setIsLoadingData(false); 
    }
  }, [canManageWorkflows]);

  useEffect(() => { if (!authLoading) fetchData(); }, [authLoading, fetchData]);

  const parentSectors = useMemo(() => sectors.filter(s => !s.parentId), [sectors]);
  const childSectors = useMemo(() => sectors.filter(s => s.parentId), [sectors]);

  const workflowsByParent = useMemo(() => {
    const grouped: Record<string, WorkflowDefinition[]> = {};
    workflowDefinitions.forEach(wf => {
      const pId = wf.parentSectorId || 'none';
      if (!grouped[pId]) grouped[pId] = [];
      grouped[pId].push(wf);
    });
    // Sort workflows by order
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => (a.order || 0) - (b.order || 0));
    });
    return grouped;
  }, [workflowDefinitions]);

  const handleToggleExpandAll = () => {
    if (expandedPaths.length > 0) {
      setExpandedPaths([]);
    } else {
      setExpandedPaths(parentSectors.map(s => `path-${s.id}`));
    }
  };

  const handleAddParentSector = async () => {
    if (!newSectorName.trim()) return;
    const result = await addSector(newSectorName.trim(), null);
    if (!result.error) {
      setNewSectorName('');
      fetchData();
      toast({ title: "Success", description: "Parent sector added." });
    }
  };

  const handleAddRequestType = async () => {
    if (!newRequestTypeName.trim()) return;
    const result = await addRequestType(newRequestTypeName.trim());
    if (!result.error) {
      setNewRequestTypeName('');
      fetchData();
      toast({ title: "Success", description: "Request type added." });
    }
  };

  const handleSaveChanges = async () => {
    setIsSavingAll(true);
    const result = await saveWorkflowDefinitions(workflowDefinitions);
    if (!result.error) {
      toast({ title: "Success", description: "All settings saved to database." });
      await fetchData();
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    }
    setIsSavingAll(false);
  };

  if (authLoading || isLoadingData) return <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8 pb-20 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Settings</h1>
          <p className="text-muted-foreground">Configure various aspects of the LoanFlow application. Access to specific sections depends on your permissions.</p>
        </div>
        <Button onClick={handleSaveChanges} disabled={isSavingAll} className="bg-primary text-primary-foreground font-bold shadow-lg">
          {isSavingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
          Save All Settings to Database
        </Button>
      </div>

      {/* 1. Administrative Areas */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2"><UserCog className="h-5 w-5 text-primary"/> Administrative Areas</h2>
        <p className="text-xs text-muted-foreground -mt-3">Quick links to other editing and management pages.</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/settings/departments"><Button variant="outline" size="sm">Manage Departments</Button></Link>
          <Link href="/settings/branches"><Button variant="outline" size="sm">Manage Branches & Districts</Button></Link>
          <Link href="/settings/roles-management"><Button variant="outline" size="sm">Manage Roles</Button></Link>
          <Link href="/settings/user-assignments"><Button variant="outline" size="sm">Manage User Assignments</Button></Link>
          <Link href="/settings/register-user"><Button variant="outline" size="sm">Register New User</Button></Link>
        </div>
      </section>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* 2. Manage Sectors */}
        <Card className="lg:col-span-2 shadow-sm border-primary/10">
          <CardHeader className="bg-muted/30">
            <CardTitle className="text-xl flex items-center gap-2"><ListTree className="h-5 w-5 text-primary"/> Manage Sectors</CardTitle>
            <CardDescription>Define parent and child business sectors.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-4">
              <div className="flex gap-2 items-end">
                <div className="flex-grow">
                  <Label className="text-xs font-bold uppercase mb-1.5 block">Add Parent Sector</Label>
                  <Input placeholder="e.g. Service & Mining Sector" value={newSectorName} onChange={e => setNewSectorName(e.target.value)} />
                </div>
                <Button onClick={handleAddParentSector} disabled={!newSectorName.trim()}><PlusCircle className="mr-2 h-4 w-4"/> Add</Button>
              </div>
              
              <div className="space-y-2 pt-4">
                <Label className="text-xs font-bold uppercase mb-2 block">Existing Sectors</Label>
                <Accordion type="multiple" className="w-full space-y-2">
                  {parentSectors.map(p => (
                    <AccordionItem key={p.id} value={p.id} className="border rounded-lg bg-card overflow-hidden">
                      <AccordionTrigger className="hover:no-underline px-4 py-3 bg-muted/10">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-sm">{p.name}</span>
                          <Badge variant="outline" className="text-[10px]">{childSectors.filter(c => c.parentId === p.id).length} children</Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-4 space-y-3 bg-background">
                        <div className="flex items-center gap-2 border-b pb-3 mb-3">
                           <Input placeholder="Add Child Sector..." className="h-8 text-xs" />
                           <Button size="sm" variant="secondary" className="h-8 text-xs"><PlusCircle className="mr-1 h-3 w-3"/> Add</Button>
                        </div>
                        {childSectors.filter(c => c.parentId === p.id).map(c => (
                          <div key={c.id} className="flex items-center justify-between group p-2 rounded-md hover:bg-muted/30 transition-colors">
                            <span className="text-sm">• {c.name}</span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-7 w-7"><Edit className="h-3 w-3"/></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3 w-3"/></Button>
                            </div>
                          </div>
                        ))}
                        <div className="pt-4 flex justify-end gap-2 border-t mt-4">
                           <Button variant="ghost" size="sm" className="text-xs"><Edit className="mr-1 h-3 w-3"/> Edit Parent</Button>
                           <Button variant="ghost" size="sm" className="text-xs text-destructive"><Trash2 className="mr-1 h-3 w-3"/> Delete Parent</Button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Manage Request Types */}
        <Card className="shadow-sm border-primary/10">
          <CardHeader className="bg-muted/30">
            <CardTitle className="text-xl flex items-center gap-2"><Workflow className="h-5 w-5 text-primary"/> Manage Request Types</CardTitle>
            <CardDescription>Define loan request types.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="flex gap-2 items-end">
              <div className="flex-grow">
                <Input placeholder="e.g. Additional Facility" value={newRequestTypeName} onChange={e => setNewRequestTypeName(e.target.value)} />
              </div>
              <Button onClick={handleAddRequestType} disabled={!newRequestTypeName.trim()}>Add</Button>
            </div>
            <div className="space-y-2 border rounded-lg p-2 bg-muted/5">
              {requestTypes.map(rt => (
                <div key={rt.id} className="flex items-center justify-between p-2 rounded-md border bg-card hover:shadow-sm transition-all group">
                  <span className="text-sm font-medium">{rt.name}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px]"><Edit className="mr-1 h-3 w-3"/> Edit</Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] text-destructive"><Trash2 className="mr-1 h-3 w-3"/> Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. Workflow Definitions Form */}
      <Card className="shadow-sm border-primary/10">
        <CardHeader className="bg-muted/30">
          <CardTitle className="text-xl flex items-center gap-2"><PlusCircle className="h-5 w-5 text-primary"/> Workflow Definitions</CardTitle>
          <CardDescription>Manage workflows from here can run certain version for from specific Parent Sector.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-bold uppercase mb-1 block">Workflow Name</Label>
                <Input placeholder="e.g. RM-01 Credit Flow" />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase mb-1 block">For Parent Sector</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Select Parent Sector" /></SelectTrigger>
                  <SelectContent>{parentSectors.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-bold uppercase mb-1 block">Description</Label>
                <Textarea placeholder="Brief description of this workflow path..." rows={3} />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-bold uppercase mb-1 block">Owning Department</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Select Department" /></SelectTrigger>
                  <SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-bold uppercase mb-1 block">For Child Sector</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Select Child Sector" /></SelectTrigger>
                  <SelectContent>{childSectors.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-bold uppercase mb-1 block">Insert</Label>
                  <Select defaultValue="after"><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="after">After</SelectItem><SelectItem value="before">Before</SelectItem></SelectContent></Select>
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase mb-1 block">Reference Workflow</Label>
                  <Select defaultValue="none"><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">Top / Initial</SelectItem></SelectContent></Select>
                </div>
              </div>
              <div className="pt-2">
                <Button className="w-full bg-primary text-primary-foreground font-bold h-12 shadow-md"><PlusCircle className="mr-2 h-5 w-5"/> Add Workflow</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5. Current Workflow Paths & Definitions */}
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-black uppercase tracking-widest text-primary flex items-center gap-3">
            <Workflow className="h-6 w-6" /> Current workflow paths & Definitions
          </h2>
          <Button variant="ghost" size="sm" onClick={handleToggleExpandAll} className="text-xs font-bold border border-primary/20 hover:bg-primary/5">
            {expandedPaths.length > 0 ? <><EyeOff className="mr-2 h-4 w-4"/> Collapse All</> : <><Eye className="mr-2 h-4 w-4"/> Expand All</>}
          </Button>
        </div>

        <Accordion type="multiple" value={expandedPaths} onValueChange={setExpandedPaths} className="space-y-8">
          {parentSectors.map(parent => {
            const pathWorkflows = workflowsByParent[parent.id] || [];
            if (pathWorkflows.length === 0) return null;

            return (
              <AccordionItem key={parent.id} value={`path-${parent.id}`} className="border-none">
                <div className="bg-primary/5 rounded-xl border border-primary/10 overflow-hidden shadow-sm">
                  <AccordionTrigger className="hover:no-underline px-6 py-4 border-b border-primary/10 bg-primary/10 data-[state=open]:rounded-b-none">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary rounded-lg text-primary-foreground"><ListTree className="h-5 w-5"/></div>
                      <h3 className="text-xl font-black text-primary uppercase">Path for {parent.name}</h3>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-6 space-y-10">
                    {/* Visual Numbered Sequence Bar */}
                    <div className="relative pt-4 pb-8">
                      <div className="flex items-center justify-between w-full overflow-x-auto gap-4 pb-4 px-2 scrollbar-hide">
                        {pathWorkflows.map((wf, idx) => (
                          <React.Fragment key={wf.id}>
                            <div className="flex flex-col items-center min-w-[120px] text-center gap-3 group">
                              <div className={cn(
                                "z-10 flex h-10 w-10 items-center justify-center rounded-full border-4 font-black transition-all",
                                "bg-primary text-primary-foreground border-white shadow-md group-hover:scale-110"
                              )}>
                                {idx + 1}
                              </div>
                              <div className="space-y-1 max-w-[140px]">
                                <p className="text-[10px] font-black uppercase leading-tight text-primary/80 line-clamp-2">{wf.name.split('–')[0]}</p>
                                <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-tighter line-clamp-1">{wf.sectorName}</p>
                              </div>
                            </div>
                            {idx < pathWorkflows.length - 1 && (
                              <div className="h-[2px] min-w-[20px] bg-primary/20 flex-grow mt-5 opacity-50" />
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>

                    {/* Detailed List of Definitions */}
                    <div className="space-y-4">
                      {pathWorkflows.map((wf, idx) => {
                        const activeVer = wf.versions.find(v => v.isActive);
                        return (
                          <div key={wf.id} className="relative group">
                            <div className="flex items-start gap-4">
                              <div className="mt-2 text-2xl font-black text-primary/20 group-hover:text-primary transition-colors">{idx + 1}.</div>
                              <Card className="flex-grow shadow-sm border-primary/10 hover:border-primary/30 transition-all">
                                <CardContent className="p-4">
                                  <div className="flex flex-col md:flex-row justify-between gap-4">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <h4 className="font-black text-lg text-foreground/90">{wf.name}</h4>
                                        <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 cursor-default">Active</Badge>
                                      </div>
                                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground font-medium">
                                        <span className="flex items-center gap-1"><Users className="h-3 w-3"/> {wf.departmentName}</span>
                                        <span className="flex items-center gap-1"><ArrowRight className="h-3 w-3"/> {wf.sectorName}</span>
                                      </div>
                                      <p className="text-xs italic text-muted-foreground/80 mt-2 max-w-2xl">{wf.description}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-2 shrink-0">
                                      <Button variant="ghost" size="sm" className="h-8 text-xs font-bold hover:text-primary"><Edit className="mr-1.5 h-3.5 w-3.5"/> Edit Definition</Button>
                                      <div className="flex gap-2">
                                        {activeVer && (
                                          <Badge variant="outline" className="h-8 px-3 font-bold border-primary/20 bg-primary/5 text-primary">
                                            Version {activeVer.versionNumber} ({activeVer.stages.length} Stages)
                                          </Badge>
                                        )}
                                        <Button size="sm" className="h-8 text-xs font-bold border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100"><ArrowRight className="mr-1.5 h-3.5 w-3.5"/> Deactivate</Button>
                                        <Button size="sm" className="h-8 text-xs font-bold border-primary/20 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"><PlusCircle className="mr-1.5 h-3.5 w-3.5"/> Add Stages</Button>
                                      </div>
                                      <Button variant="link" size="sm" className="h-6 p-0 text-[10px] text-muted-foreground underline decoration-primary/30">View Version History</Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </div>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </div>
  );
}
