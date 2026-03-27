
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Workflow,
  Edit3
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
    insertAction: 'after',
    referenceWfId: 'none'
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
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => (a.order || 0) - (b.order || 0));
    });
    return grouped;
  }, [workflowDefinitions]);

  // Filter reference workflows based on selected parent sector in the form
  const referenceWorkflows = useMemo(() => {
    if (!newWfForm.parentSectorId) return [];
    return workflowDefinitions
      .filter(wf => wf.parentSectorId === newWfForm.parentSectorId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [workflowDefinitions, newWfForm.parentSectorId]);

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
          <h1 className="text-3xl font-black tracking-tight text-primary uppercase">Settings</h1>
          <p className="text-muted-foreground font-medium">Configure various aspects of the LoanFlow application. Access depends on your permissions.</p>
        </div>
        <Button onClick={handleSaveChanges} disabled={isSavingAll} className="bg-primary text-primary-foreground font-bold shadow-lg h-12 px-6">
          {isSavingAll ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Database className="mr-2 h-5 w-5" />}
          Save All Settings to Database
        </Button>
      </div>

      {/* 1. Administrative Areas */}
      <section className="space-y-4">
        <h2 className="text-lg font-black flex items-center gap-2 text-primary uppercase tracking-widest"><UserCog className="h-5 w-5"/> Administrative Areas</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/settings/departments"><Button variant="outline" size="sm" className="font-bold border-primary/20 hover:bg-primary/5">Manage Departments</Button></Link>
          <Link href="/settings/branches"><Button variant="outline" size="sm" className="font-bold border-primary/20 hover:bg-primary/5">Manage Branches & Districts</Button></Link>
          <Link href="/settings/roles-management"><Button variant="outline" size="sm" className="font-bold border-primary/20 hover:bg-primary/5">Manage Roles</Button></Link>
          <Link href="/settings/user-assignments"><Button variant="outline" size="sm" className="font-bold border-primary/20 hover:bg-primary/5">Manage User Assignments</Button></Link>
          <Link href="/settings/register-user"><Button variant="outline" size="sm" className="font-bold border-primary/20 hover:bg-primary/5">Register New User</Button></Link>
        </div>
      </section>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* 2. Manage Sectors */}
        <Card className="lg:col-span-2 shadow-sm border-primary/10">
          <CardHeader className="bg-muted/30 border-b border-primary/5">
            <CardTitle className="text-xl font-black flex items-center gap-2 text-primary uppercase"><ListTree className="h-5 w-5"/> Manage Sectors</CardTitle>
            <CardDescription className="font-medium">Define parent and child business sectors.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-4">
              <div className="flex gap-2 items-end">
                <div className="flex-grow">
                  <Label className="text-xs font-black uppercase mb-1.5 block text-primary/70">Add Parent Sector</Label>
                  <Input placeholder="e.g. Service & Mining Sector" value={newSectorName} onChange={e => setNewSectorName(e.target.value)} className="h-11" />
                </div>
                <Button onClick={handleAddParentSector} disabled={!newSectorName.trim()} className="h-11 font-bold"><PlusCircle className="mr-2 h-4 w-4"/> Add</Button>
              </div>
              
              <div className="space-y-2 pt-4">
                <Label className="text-xs font-black uppercase mb-2 block text-primary/70">Existing Sectors</Label>
                <Accordion type="multiple" className="w-full space-y-2">
                  {parentSectors.map(p => (
                    <AccordionItem key={p.id} value={p.id} className="border rounded-lg bg-card overflow-hidden">
                      <AccordionTrigger className="hover:no-underline px-4 py-3 bg-muted/10">
                        <div className="flex items-center gap-3">
                          <span className="font-black text-sm uppercase tracking-tight">{p.name}</span>
                          <Badge variant="outline" className="text-[10px] font-bold border-primary/20">{childSectors.filter(c => c.parentId === p.id).length} children</Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-4 space-y-3 bg-background">
                        <div className="flex items-center gap-2 border-b pb-3 mb-3">
                           <Input placeholder="Add Child Sector..." className="h-9 text-xs" />
                           <Button size="sm" variant="secondary" className="h-9 text-xs font-bold"><PlusCircle className="mr-1 h-3 w-3"/> Add Child</Button>
                        </div>
                        {childSectors.filter(c => c.parentId === p.id).map(c => (
                          <div key={c.id} className="flex items-center justify-between group p-2 rounded-md hover:bg-muted/30 transition-colors">
                            <span className="text-sm font-medium">• {c.name}</span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-primary"><Edit className="h-3.5 w-3.5"/></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/5"><Trash2 className="h-3.5 w-3.5"/></Button>
                            </div>
                          </div>
                        ))}
                        <div className="pt-4 flex justify-end gap-2 border-t mt-4">
                           <Button variant="ghost" size="sm" className="text-xs font-bold"><Edit className="mr-1.5 h-3.5 w-3.5"/> Edit Parent</Button>
                           <Button variant="ghost" size="sm" className="text-xs font-bold text-destructive hover:bg-destructive/5"><Trash2 className="mr-1.5 h-3.5 w-3.5"/> Delete Parent</Button>
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
          <CardHeader className="bg-muted/30 border-b border-primary/5">
            <CardTitle className="text-xl font-black flex items-center gap-2 text-primary uppercase"><Workflow className="h-5 w-5"/> Manage Request Types</CardTitle>
            <CardDescription className="font-medium">Define loan request types.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="flex gap-2 items-end">
              <div className="flex-grow">
                <Input placeholder="e.g. Additional Facility" value={newRequestTypeName} onChange={e => setNewRequestTypeName(e.target.value)} className="h-11" />
              </div>
              <Button onClick={handleAddRequestType} disabled={!newRequestTypeName.trim()} className="h-11 font-bold">Add</Button>
            </div>
            <div className="space-y-2 border rounded-lg p-2 bg-muted/5 min-h-[300px]">
              {requestTypes.map(rt => (
                <div key={rt.id} className="flex items-center justify-between p-3 rounded-md border bg-card hover:shadow-sm transition-all group">
                  <span className="text-sm font-black uppercase tracking-tight">{rt.name}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] font-bold"><Edit className="mr-1.5 h-3.5 w-3.5"/> Edit</Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] font-bold text-destructive hover:bg-destructive/5"><Trash2 className="mr-1.5 h-3.5 w-3.5"/> Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. Workflow Definitions Form */}
      <Card className="shadow-sm border-primary/10">
        <CardHeader className="bg-muted/30 border-b border-primary/5">
          <CardTitle className="text-xl font-black flex items-center gap-2 text-primary uppercase"><PlusCircle className="h-5 w-5"/> Add Workflow Definition</CardTitle>
          <CardDescription className="font-medium">Define a new workflow path component for specific sector paths.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-5">
              <div>
                <Label className="text-xs font-black uppercase mb-1.5 block text-primary/70">Workflow Name</Label>
                <Input placeholder="e.g. WF-09 Credit Analysis" className="h-11" />
              </div>
              <div>
                <Label className="text-xs font-black uppercase mb-1.5 block text-primary/70">For Parent Sector (Required for Pathing)</Label>
                <Select onValueChange={(val) => setNewWfForm(prev => ({ ...prev, parentSectorId: val, referenceWfId: 'none' }))}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Select Parent Sector" /></SelectTrigger>
                  <SelectContent>{parentSectors.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-black uppercase mb-1.5 block text-primary/70">Description</Label>
                <Textarea placeholder="Brief description of this workflow path's purpose..." rows={4} className="resize-none" />
              </div>
            </div>
            <div className="space-y-5">
              <div>
                <Label className="text-xs font-black uppercase mb-1.5 block text-primary/70">Owning Department</Label>
                <Select>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Select Department" /></SelectTrigger>
                  <SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-black uppercase mb-1.5 block text-primary/70">For Child Sector</Label>
                <Select>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Select Child Sector" /></SelectTrigger>
                  <SelectContent>{childSectors.filter(c => c.parentId === newWfForm.parentSectorId).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-black uppercase mb-1.5 block text-primary/70">Position</Label>
                  <Select defaultValue="after"><SelectTrigger className="h-11"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="after">Insert After</SelectItem><SelectItem value="before">Insert Before</SelectItem></SelectContent></Select>
                </div>
                <div>
                  <Label className="text-xs font-black uppercase mb-1.5 block text-primary/70">Reference Workflow</Label>
                  <Select value={newWfForm.referenceWfId} onValueChange={val => setNewWfForm(prev => ({...prev, referenceWfId: val}))}>
                    <SelectTrigger className="h-11"><SelectValue placeholder={newWfForm.parentSectorId ? "Choose Reference..." : "Select Parent Sector First"}/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Initial (Top of List)</SelectItem>
                      {referenceWorkflows.map(wf => (
                        <SelectItem key={wf.id} value={wf.id}>{wf.name.split('–')[0]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="pt-2">
                <Button className="w-full bg-primary text-primary-foreground font-black uppercase h-12 shadow-lg hover:scale-[1.01] transition-transform"><PlusCircle className="mr-2 h-5 w-5"/> Create Workflow Definition</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5. Current Workflow Paths & Definitions */}
      <div className="space-y-6">
        <div className="flex justify-between items-center px-1">
          <h2 className="text-2xl font-black uppercase tracking-[0.2em] text-primary flex items-center gap-3">
            <Workflow className="h-6 w-6" /> Current workflow paths & Definitions
          </h2>
          <Button variant="ghost" size="sm" onClick={handleToggleExpandAll} className="text-xs font-black uppercase border border-primary/20 hover:bg-primary/5 h-9 px-4 gap-2">
            {expandedPaths.length > 0 ? <><EyeOff className="h-4 w-4"/> Collapse All</> : <><Eye className="h-4 w-4"/> Expand All</>}
          </Button>
        </div>

        <Accordion type="multiple" value={expandedPaths} onValueChange={setExpandedPaths} className="space-y-8">
          {parentSectors.map(parent => {
            const pathWorkflows = workflowsByParent[parent.id] || [];
            if (pathWorkflows.length === 0) return null;

            return (
              <AccordionItem key={parent.id} value={`path-${parent.id}`} className="border-none">
                <div className="bg-primary/5 rounded-2xl border border-primary/10 overflow-hidden shadow-sm">
                  <AccordionTrigger className="hover:no-underline px-6 py-5 border-b border-primary/10 bg-primary/10 data-[state=open]:rounded-b-none">
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 bg-primary rounded-xl text-primary-foreground shadow-md"><ListTree className="h-6 w-6"/></div>
                      <h3 className="text-xl font-black text-primary uppercase tracking-wide">Path for {parent.name}</h3>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-6 space-y-12">
                    {/* Visual Numbered Sequence Bar with Scrollbar */}
                    <div className="space-y-2">
                      <div className="flex items-center w-full overflow-x-auto gap-0 pb-4 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
                        {pathWorkflows.map((wf, idx) => (
                          <React.Fragment key={wf.id}>
                            <div className="flex flex-col items-center min-w-[160px] text-center gap-3 group relative px-4">
                              <div className={cn(
                                "z-10 flex h-12 w-12 items-center justify-center rounded-full border-4 font-black text-lg transition-all",
                                "bg-primary text-primary-foreground border-white shadow-lg group-hover:scale-110"
                              )}>
                                {idx + 1}
                              </div>
                              <div className="space-y-1">
                                <p className="text-[11px] font-black uppercase leading-none text-primary line-clamp-1">{wf.name.split('–')[0]}</p>
                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter line-clamp-1 opacity-70">{wf.sectorName}</p>
                              </div>
                            </div>
                            {idx < pathWorkflows.length - 1 && (
                              <div className="h-[2px] min-w-[40px] bg-primary/20 flex-grow mt-6" />
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                      <div className="h-1.5 bg-muted/30 rounded-full w-full overflow-hidden">
                         <div className="h-full bg-primary/20 w-1/3 rounded-full" /> {/* Visual hint of scroll */}
                      </div>
                    </div>

                    {/* Detailed List of Definitions */}
                    <div className="space-y-5">
                      {pathWorkflows.map((wf, idx) => {
                        const activeVer = wf.versions.find(v => v.isActive);
                        return (
                          <div key={wf.id} className="relative group pl-2">
                            <div className="flex items-start gap-6">
                              <div className="mt-2 text-3xl font-black text-primary/10 group-hover:text-primary transition-colors min-w-[40px]">{idx + 1}.</div>
                              <Card className="flex-grow shadow-md border-primary/5 hover:border-primary/30 transition-all bg-card">
                                <CardContent className="p-5">
                                  <div className="flex flex-col md:flex-row justify-between gap-6">
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-3">
                                        <h4 className="font-black text-xl text-foreground uppercase tracking-tight">{wf.name}</h4>
                                        <Badge className="bg-primary/10 text-primary border-primary/20 font-black uppercase text-[10px] h-5">Active</Badge>
                                      </div>
                                      <div className="flex flex-col gap-1.5 text-xs font-bold text-muted-foreground/80">
                                        <div className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-primary/60"/> Owning Dept: <span className="text-foreground">{wf.departmentName}</span></div>
                                        <div className="flex items-center gap-2"><ArrowRight className="h-3.5 w-3.5 text-primary/60"/> Target Child Sector: <span className="text-foreground">{wf.sectorName}</span></div>
                                      </div>
                                      <p className="text-xs italic text-muted-foreground font-medium mt-3 max-w-3xl leading-relaxed">{wf.description}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-3 shrink-0">
                                      <Button variant="ghost" size="sm" className="h-8 text-xs font-black uppercase hover:text-primary gap-1.5"><Edit3 className="h-4 w-4"/> Edit Definition</Button>
                                      <div className="flex items-center gap-3">
                                        {activeVer && (
                                          <Badge variant="outline" className="h-10 px-4 font-black uppercase text-xs border-primary/20 bg-primary/5 text-primary">
                                            Version {activeVer.versionNumber} ({activeVer.stages.length} Stages)
                                          </Badge>
                                        )}
                                        <Button variant="ghost" size="sm" className="h-10 text-xs font-black uppercase text-orange-700 hover:bg-orange-50 gap-1.5"><ArrowRight className="h-4 w-4"/> Deactivate</Button>
                                        <Button size="sm" className="h-10 px-5 font-black uppercase text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-md gap-2"><PlusCircle className="h-4 w-4"/> Add Stages</Button>
                                      </div>
                                      <Button variant="link" size="sm" className="h-6 p-0 text-[10px] font-bold text-muted-foreground underline underline-offset-4 decoration-primary/30">View Version History</Button>
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
