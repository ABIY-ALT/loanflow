
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Trash2, Save, Clock, GripVertical, Users, Edit, ShieldCheck, ShieldOff, Loader2, Briefcase, Network, UserCog, ChevronDown } from 'lucide-react';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { WorkflowDefinition, WorkflowVersion, WorkflowStageDefinition, Department, DocumentRequirement, Sector, RequestType } from '@/types/loan';
import { DocumentRequirementType } from '@/types/loan';
import { PERMISSIONS } from '@/lib/permissions';
import { getWorkflowDefinitions, saveWorkflowDefinitions, getDepartments } from '@/services/loan-service-prisma';
import { getSectors, addSector, deleteSector, updateSector, getRequestTypes, addRequestType, deleteRequestType } from '@/services/sector-and-request-type-service';
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
import { Checkbox } from '@/components/ui/checkbox';

const createNewStage = (name: string, departmentName: string, timeline: number, weight: number, order: number): WorkflowStageDefinition => ({
  id: `stage-custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
  name,
  responsibleDepartment: departmentName,
  defaultTimelineDays: timeline,
  documentRequirements: [],
  percentageWeight: weight,
  order: order,
  allowedRoles: [],
  requiresApproval: true,
  availableStatuses: { [departmentName]: ['Initiated', 'In Progress', 'Completed', 'Pending', 'Returned'] },
});

const createNewDocumentRequirement = (name: string, isMandatory: boolean, type: DocumentRequirementType): DocumentRequirement => ({
  id: `doc-req-custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
  name,
  isMandatory,
  type,
});

interface DepartmentObject {
  id: string;
  name: Department;
}

interface WorkflowStageConfigItemProps {
  stage: WorkflowStageDefinition;
  workflowVersionId: string;
  allRoles: AppRole[];
  onStageChange: (versionId: string, stageId: string, field: keyof WorkflowStageDefinition, value: any) => void;
  onRemoveStage: (versionId: string, stageId: string) => void;
  onAddRequiredDocument: (versionId: string, stageId: string, docName: string) => void;
  onUpdateRequiredDocument: (versionId: string, stageId: string, docReq: DocumentRequirement) => void;
  onRemoveRequiredDocument: (versionId: string, stageId: string, docReqId: string) => void;
  onAddStatus: (versionId: string, stageId: string, department: string, statusName: string) => void;
  onRemoveStatus: (versionId: string, stageId: string, department: string, statusName: string) => void;
}

function WorkflowStageConfigItem({
  stage,
  workflowVersionId,
  allRoles,
  onStageChange,
  onRemoveStage,
  onAddRequiredDocument,
  onUpdateRequiredDocument,
  onRemoveRequiredDocument,
  onAddStatus,
  onRemoveStatus,
}: WorkflowStageConfigItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 100 : 'auto', opacity: isDragging ? 0.8 : 1, position: 'relative' as 'relative' };
  const [newReqDocName, setNewReqDocName] = useState('');
  const [newStatusName, setNewStatusName] = useState('');
  
  const departmentForStatus = stage.responsibleDepartment;

  const handleAddDoc = () => {
    if (newReqDocName.trim()) {
      onAddRequiredDocument(workflowVersionId, stage.id, newReqDocName.trim());
      setNewReqDocName('');
    }
  };

  const handleAddStatus = () => {
    if (newStatusName.trim() && departmentForStatus) {
      onAddStatus(workflowVersionId, stage.id, departmentForStatus, newStatusName.trim());
      setNewStatusName('');
    }
  };

  return (
    <AccordionItem value={stage.id} key={stage.id} ref={setNodeRef} style={style} className="bg-card border rounded-md mb-2 shadow-sm">
      <AccordionTrigger className="hover:no-underline w-full data-[state=open]:border-b">
        <div className="flex items-center justify-between w-full pr-4 py-2">
          <div className="flex items-center" {...attributes} {...listeners} >
            <GripVertical className="h-5 w-5 text-muted-foreground mr-3 cursor-grab" />
            <span>{stage.order + 1}. {stage.name}</span>
          </div>
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            {stage.requiresApproval ? <ShieldCheck className="h-4 w-4 text-green-600"/> : <ShieldOff className="h-4 w-4 text-amber-600"/>}
            <Users className="h-4 w-4"/>{stage.responsibleDepartment || 'N/A'} | <Clock className="h-4 w-4"/>{stage.defaultTimelineDays}d
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="space-y-6 p-4 bg-background rounded-b-md">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div><Label>Stage Name</Label><Input value={stage.name} onChange={(e) => onStageChange(workflowVersionId, stage.id, 'name', e.target.value)} className="mt-1"/></div>
          <div><Label>Responsible Dept</Label><Input value={stage.responsibleDepartment} className="mt-1" disabled /></div>
          <div><Label>Timeline (days)</Label><Input type="number" value={stage.defaultTimelineDays} onChange={(e) => onStageChange(workflowVersionId, stage.id, 'defaultTimelineDays', parseInt(e.target.value,10) || 0)} className="mt-1" min="0"/></div>
          <div className="flex items-center space-x-2 pt-6">
            <Switch id={`s-approval-${stage.id}`} checked={stage.requiresApproval} onCheckedChange={(v) => onStageChange(workflowVersionId, stage.id, 'requiresApproval', v)}/>
            <Label htmlFor={`s-approval-${stage.id}`}>Requires Approval</Label>
          </div>
        </div>
        <Separator />
        <div className="flex justify-end"><Button variant="outline" size="sm" onClick={() => onRemoveStage(workflowVersionId, stage.id)} className="text-destructive border-destructive"><Trash2 className="mr-2 h-4 w-4" /> Remove Stage</Button></div>
      </AccordionContent>
    </AccordionItem>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSavingData, setIsSavingData] = useState(false);
  const [isSavingAll, setIsSavingAll] = useState(false);
  
  const [workflowDefinitions, setWorkflowDefinitions] = useState<WorkflowDefinition[]>([]);
  const [departments, setDepartments] = useState<DepartmentObject[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [newWorkflowDepartmentId, setNewWorkflowDepartmentId] = useState('');
  const [newWorkflowParentSectorId, setNewWorkflowParentSectorId] = useState('');
  const [newWorkflowChildSectorId, setNewWorkflowChildSectorId] = useState('');

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
    } catch (e) { console.error(e); }
    finally { setIsLoadingData(false); }
  }, [canManageWorkflows]);

  useEffect(() => { if (!authLoading) fetchData(); }, [authLoading, fetchData]);

  const workflowsGrouped = useMemo(() => {
    const grouped: Record<string, { parentName: string, children: Record<string, { childName: string, workflows: WorkflowDefinition[] }> }> = {};
    workflowDefinitions.forEach(wf => {
      const pId = wf.parentSectorId || 'none';
      const cId = wf.sectorId || 'none';
      if (!grouped[pId]) grouped[pId] = { parentName: wf.parentSectorName || 'Standard', children: {} };
      if (!grouped[pId].children[cId]) grouped[pId].children[cId] = { childName: wf.sectorName || 'General', workflows: [] };
      grouped[pId].children[cId].workflows.push(wf);
    });
    // Sort workflows by order
    Object.values(grouped).forEach(p => {
      Object.values(p.children).forEach(c => {
        c.workflows.sort((a,b) => (a.order || 0) - (b.order || 0));
      });
    });
    return grouped;
  }, [workflowDefinitions]);

  const handleSaveChanges = async () => {
    setIsSavingAll(true);
    const result = await saveWorkflowDefinitions(workflowDefinitions);
    if (!result.error) {
      toast({ title: "Success", description: "Settings saved successfully." });
      await fetchData();
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    }
    setIsSavingAll(false);
  };

  const handleActivateVersion = (defId: string, verId: string) => {
    setWorkflowDefinitions(prev => prev.map(def => {
      if (def.id === defId) {
        return { ...def, versions: def.versions.map(v => ({ ...v, isActive: v.id === verId })) };
      }
      return def;
    }));
  };

  if (authLoading || isLoadingData) return <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workflow & Path Management</h1>
          <p className="text-muted-foreground">Manage sector-based loan paths and stage configurations.</p>
        </div>
        <Button onClick={handleSaveChanges} disabled={isSavingAll}>
          {isSavingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save All Changes
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Access Management</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/settings/departments"><Button variant="outline">Departments</Button></Link>
          <Link href="/settings/branches"><Button variant="outline">Branches</Button></Link>
          <Link href="/settings/roles-management"><Button variant="outline">Roles</Button></Link>
          <Link href="/settings/user-assignments"><Button variant="outline">User Assignments</Button></Link>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {Object.entries(workflowsGrouped).map(([pId, parentGroup]) => (
          <div key={pId} className="space-y-4">
            <h2 className="text-xl font-black uppercase tracking-widest text-primary flex items-center gap-2">
              <Network className="h-5 w-5" /> {parentGroup.parentName} Path
            </h2>
            <div className="grid gap-6">
              {Object.entries(parentGroup.children).map(([cId, childGroup]) => (
                <Card key={cId} className="border-l-4 border-l-primary shadow-sm">
                  <CardHeader className="bg-muted/30 pb-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      {childGroup.childName} Line
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    {childGroup.workflows.map(wf => (
                      <div key={wf.id} className="p-4 border rounded-xl bg-card hover:shadow-md transition-all">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="font-bold text-lg">{wf.name}</h3>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-tighter">Owning Dept: {wf.departmentName}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm"><Edit className="h-4 w-4 mr-1"/> Edit Info</Button>
                            <Button variant="outline" size="sm">+ New Version</Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {wf.versions.map(v => (
                            <div key={v.id} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${v.isActive ? 'bg-primary/5 border-primary/20' : 'bg-muted/20 opacity-70'}`}>
                              <div className="flex items-center gap-3">
                                <Badge variant={v.isActive ? "default" : "outline"} className="font-bold">V{v.versionNumber}</Badge>
                                <span className="text-sm font-semibold">{v.stages.length} Stages</span>
                                {v.isActive && <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">Active</Badge>}
                              </div>
                              <div className="flex items-center gap-2">
                                <Button variant={v.isActive ? "secondary" : "ghost"} size="sm" onClick={() => handleActivateVersion(wf.id, v.id)}>{v.isActive ? 'Deactivate' : 'Activate'}</Button>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Edit className="h-4 w-4" /></Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
