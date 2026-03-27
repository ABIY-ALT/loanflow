'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  Check, 
  PlusCircle, 
  Trash2, 
  AlertTriangle, 
  Save, 
  Clock, 
  GripVertical, 
  FileText, 
  Users, 
  Percent, 
  Eye, 
  EyeOff,
  Edit, 
  Loader2, 
  ShieldAlert, 
  ArrowLeft, 
  ArrowRight, 
  MoreVertical, 
  ChevronDown, 
  Map, 
  Briefcase, 
  Network,
  ShieldCheck,
  ShieldOff,
  Edit3
} from 'lucide-react';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { getSectors, addSector, deleteSector, updateSector, getRequestTypes, addRequestType, deleteRequestType, updateRequestType } from '@/services/sector-and-request-type-service';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

// --- Helper Functions ---

const createNewStage = (name: string, departmentName: string, timeline: number, weight: number, order: number): WorkflowStageDefinition => ({
  id: `stage-custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
  name,
  responsibleDepartment: departmentName,
  defaultTimelineDays: timeline,
  documentRequirements: [],
  percentageWeight: weight,
  order: order,
  availableStatuses: { [departmentName]: ['Initiated', 'In Progress', 'Completed', 'Pending', 'Not Visited','Returned'] },
  allowedRoles: [],
  requiresApproval: true
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

// --- Component: WorkflowStageConfigItem ---

interface WorkflowStageConfigItemProps {
  stage: WorkflowStageDefinition;
  workflowVersionId: string;
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
            <span className="font-bold">{stage.order + 1}. {stage.name}</span>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <Users className="h-3.5 w-3.5"/>{stage.responsibleDepartment} | <Clock className="h-3.5 w-3.5"/>{stage.defaultTimelineDays}d | <Percent className="h-3.5 w-3.5" />{stage.percentageWeight}%
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="space-y-6 p-4 bg-background rounded-b-md">
        <div className="grid md:grid-cols-3 gap-4">
          <div><Label className="text-[10px] uppercase font-bold">Stage Name</Label><Input value={stage.name} onChange={(e) => onStageChange(workflowVersionId, stage.id, 'name', e.target.value)} className="mt-1 h-9"/></div>
          <div><Label className="text-[10px] uppercase font-bold">Responsible Department</Label><Input value={stage.responsibleDepartment} className="mt-1 h-9 bg-muted/50" disabled /></div>
          <div><Label className="text-[10px] uppercase font-bold">Timeline (days)</Label><Input type="number" value={stage.defaultTimelineDays} onChange={(e) => onStageChange(workflowVersionId, stage.id, 'defaultTimelineDays', parseInt(e.target.value,10) || 0)} className="mt-1 h-9" min="0"/></div>
          <div><Label className="text-[10px] uppercase font-bold">Weight (%)</Label><Input type="number" value={stage.percentageWeight} onChange={(e) => onStageChange(workflowVersionId, stage.id, 'percentageWeight', parseInt(e.target.value,10) || 0)} className="mt-1 h-9" min="0" max="100"/></div>
          <div className="flex items-center space-x-2 pt-6">
            <Checkbox id={`req-approval-${stage.id}`} checked={stage.requiresApproval} onCheckedChange={(checked) => onStageChange(workflowVersionId, stage.id, 'requiresApproval', !!checked)} />
            <Label htmlFor={`req-approval-${stage.id}`} className="text-sm font-bold">Requires Manager Approval</Label>
          </div>
        </div>
        
        <Separator />
        
        <div>
            <h5 className="text-sm font-black uppercase tracking-widest text-primary mb-3">Required Documents</h5>
            <div className="space-y-2">
              {stage.documentRequirements.map((req) => (
                <div key={req.id} className="p-3 border rounded-md flex items-center gap-3 bg-muted/10">
                  <Input value={req.name} onChange={(e) => onUpdateRequiredDocument(workflowVersionId, stage.id, { ...req, name: e.target.value })} className="h-8 text-sm flex-grow"/>
                  <div className="flex items-center space-x-2 shrink-0">
                    <Checkbox id={`req-mandatory-${req.id}`} checked={req.isMandatory} onCheckedChange={(checked) => onUpdateRequiredDocument(workflowVersionId, stage.id, { ...req, isMandatory: !!checked })} />
                    <Label htmlFor={`req-mandatory-${req.id}`} className="text-xs">Mandatory</Label>
                  </div>
                  <Select value={req.type} onValueChange={(value) => onUpdateRequiredDocument(workflowVersionId, stage.id, { ...req, type: value as DocumentRequirementType })}>
                    <SelectTrigger className="h-8 w-28 text-xs"><SelectValue/></SelectTrigger>
                    <SelectContent><SelectItem value={DocumentRequirementType.UPLOAD}>Upload</SelectItem><SelectItem value={DocumentRequirementType.CHECKBOX}>Checkbox</SelectItem></SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onRemoveRequiredDocument(workflowVersionId, stage.id, req.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
            <div className="flex items-end gap-2 mt-4">
                <div className="flex-grow">
                  <Label className="text-[10px] uppercase font-bold">New Document Name</Label>
                  <Input value={newReqDocName} onChange={(e) => setNewReqDocName(e.target.value)} placeholder="e.g., ID Card" className="mt-1 h-9"/>
                </div>
                <Button onClick={handleAddDoc} size="sm" className="h-9 font-bold"><PlusCircle className="mr-2 h-4 w-4" /> Add Requirement</Button>
            </div>
        </div>

        <Separator />
        
        <div>
          <h5 className="text-sm font-black uppercase tracking-widest text-primary mb-3">Workflow Statuses</h5>
          <div className="flex flex-wrap gap-2 mb-4">
            {(stage.availableStatuses?.[departmentForStatus] || []).map((statusName, index) => (
              <Badge key={index} variant="secondary" className="h-8 px-3 gap-2 font-bold">
                {statusName}
                <button onClick={() => onRemoveStatus(workflowVersionId, stage.id, departmentForStatus, statusName)} className="hover:text-destructive transition-colors"><Trash2 className="h-3 w-3"/></button>
              </Badge>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-grow">
              <Label className="text-[10px] uppercase font-bold">Add Custom Status</Label>
              <Input value={newStatusName} onChange={(e) => setNewStatusName(e.target.value)} placeholder="e.g., On Hold" className="mt-1 h-9"/>
            </div>
            <Button onClick={handleAddStatus} size="sm" variant="outline" className="h-9 font-bold"><PlusCircle className="mr-2 h-4 w-4" /> Add Status</Button>
          </div>
        </div>
        
        <Separator />
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => onRemoveStage(workflowVersionId, stage.id)} className="text-destructive border-destructive hover:bg-destructive/10 font-bold"><Trash2 className="mr-2 h-4 w-4" /> Remove Stage From Version</Button>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

// --- Component: EditWorkflowVersionDialog ---

interface EditWorkflowVersionDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  workflowDefinition: WorkflowDefinition | null;
  versionToEdit: WorkflowVersion | null;
  onSaveVersion: (definitionId: string, version: WorkflowVersion) => void;
  departmentName: string;
}

function EditWorkflowVersionDialog({
  isOpen, onOpenChange, workflowDefinition, versionToEdit, onSaveVersion, departmentName,
}: EditWorkflowVersionDialogProps) {
  const [editedVersion, setEditedVersion] = useState<WorkflowVersion | null>(null);
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const { toast } = useToast();

  const [newStageName, setNewStageName] = useState('');
  const [newStageTimeline, setNewStageTimeline] = useState(3);
  const [newStageWeight, setNewStageWeight] = useState(10);

  useEffect(() => {
    if (versionToEdit) {
      setEditedVersion(JSON.parse(JSON.stringify(versionToEdit)));
    } else {
      setEditedVersion(null);
    }
  }, [versionToEdit]);

  const updateStageOrder = (stages: WorkflowStageDefinition[]): WorkflowStageDefinition[] => {
    return stages.map((stage, index) => ({ ...stage, order: index }));
  };

  const handleInternalStageChange = (versionId: string, stageId: string, field: keyof WorkflowStageDefinition, value: any) => {
    setEditedVersion(prev => {
      if (!prev) return null;
      return {
        ...prev,
        stages: prev.stages.map(s => s.id === stageId ? { ...s, [field]: value } : s)
      };
    });
  };

  const handleInternalRemoveStage = (versionId: string, stageId: string) => {
     setEditedVersion(prev => {
      if (!prev) return null;
      const updatedStages = prev.stages.filter(s => s.id !== stageId);
      return { ...prev, stages: updateStageOrder(updatedStages) };
    });
  };
  
  const handleInternalAddStageToVersion = () => {
    if (!editedVersion) return;
    if(!newStageName.trim()){
        toast({ title: "Error", description: "Stage name is required.", variant: "destructive"});
        return;
    }
    
    const newOrder = editedVersion.stages.length;
    const newStage = createNewStage(newStageName, departmentName, newStageTimeline, newStageWeight, newOrder);
    
    setEditedVersion(prev => {
      if (!prev) return null;
      return { ...prev, stages: updateStageOrder([...prev.stages, newStage]) };
    });

    setNewStageName('');
    setNewStageTimeline(3);
    setNewStageWeight(10);
  };

  const handleInternalReorderStages = (event: DragEndEvent) => {
    if (!editedVersion) return;
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setEditedVersion(prev => {
        if (!prev) return null;
        const oldIndex = prev.stages.findIndex((s) => s.id === active.id);
        const newIndex = prev.stages.findIndex((s) => s.id === over.id);
        const reorderedStages = arrayMove(prev.stages, oldIndex, newIndex);
        return { ...prev, stages: updateStageOrder(reorderedStages) };
      });
    }
  };

  const handleInternalAddReqDoc = (versionId: string, stageId: string, docName: string) => {
    const newDocReq = createNewDocumentRequirement(docName, true, DocumentRequirementType.UPLOAD);
    setEditedVersion(prev => {
        if(!prev) return null;
        return { ...prev, stages: prev.stages.map(s => s.id === stageId ? {...s, documentRequirements: [...s.documentRequirements, newDocReq]} : s)};
    });
  };

  const handleInternalUpdateReqDoc = (versionId: string, stageId: string, updatedReq: DocumentRequirement) => {
    setEditedVersion(prev => {
        if(!prev) return null;
        return { ...prev, stages: prev.stages.map(s => s.id === stageId ? {...s, documentRequirements: s.documentRequirements.map(req => req.id === updatedReq.id ? updatedReq : req)} : s)};
    });
  };

  const handleInternalRemoveReqDoc = (versionId: string, stageId: string, docReqId: string) => {
     setEditedVersion(prev => {
        if(!prev) return null;
        return { ...prev, stages: prev.stages.map(s => s.id === stageId ? {...s, documentRequirements: s.documentRequirements.filter(req => req.id !== docReqId)} : s)};
    });
  };

  const handleInternalAddStatus = (versionId: string, stageId: string, department: string, statusName: string) => {
    setEditedVersion(prev => {
      if (!prev) return null;
      return {
        ...prev,
        stages: prev.stages.map(s => {
          if (s.id !== stageId) return s;
          const currentStatuses = s.availableStatuses?.[department] || [];
          if (currentStatuses.includes(statusName)) return s;
          return {
            ...s,
            availableStatuses: { ...s.availableStatuses, [department]: [...currentStatuses, statusName] }
          };
        })
      };
    });
  };

  const handleInternalRemoveStatus = (versionId: string, stageId: string, department: string, statusName: string) => {
    setEditedVersion(prev => {
      if (!prev) return null;
      return {
        ...prev,
        stages: prev.stages.map(s => {
          if (s.id !== stageId) return s;
          const currentStatuses = s.availableStatuses?.[department] || [];
          return {
            ...s,
            availableStatuses: { ...s.availableStatuses, [department]: currentStatuses.filter(name => name !== statusName) }
          };
        })
      };
    });
  };

  const handleSave = () => {
    if (workflowDefinition && editedVersion) {
      const totalWeight = editedVersion.stages.reduce((sum, stage) => sum + (Number(stage.percentageWeight) || 0), 0);
      if (totalWeight > 100) {
        toast({ title: "Validation Error", description: `Total weight (${totalWeight}%) exceeds 100%.`, variant: "destructive"});
        return;
      }
      onSaveVersion(workflowDefinition.id, editedVersion);
      onOpenChange(false);
    }
  };

  if (!workflowDefinition || !editedVersion) return null;

  const currentTotalWeight = editedVersion.stages.reduce((sum, config) => sum + (Number(config.percentageWeight) || 0), 0);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase text-primary">Edit Version {editedVersion.versionNumber}</DialogTitle>
          <DialogDescription className="font-bold">
            Workflow: {workflowDefinition.name} | Total Progress Weight: <span className={cn(currentTotalWeight > 100 ? 'text-destructive' : 'text-green-600')}>{currentTotalWeight}%</span>
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto pr-2 space-y-6 py-4">
            <div className="p-4 border-2 border-dashed rounded-lg bg-muted/5">
                <h5 className="font-black uppercase text-xs tracking-widest text-muted-foreground mb-4">Add New Sequential Stage</h5>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                    <div className="sm:col-span-2"><Label className="text-[10px] uppercase font-bold">Stage Name</Label><Input value={newStageName} onChange={e=>setNewStageName(e.target.value)} placeholder="e.g. Risk Assessment" /></div>
                    <div><Label className="text-[10px] uppercase font-bold">Timeline (d)</Label><Input type="number" value={newStageTimeline} onChange={e=>setNewStageTimeline(parseInt(e.target.value,10)||0)} min="0"/></div>
                    <div><Label className="text-[10px] uppercase font-bold">Weight (%)</Label><Input type="number" value={newStageWeight} onChange={e=>setNewStageWeight(parseInt(e.target.value,10)||0)} min="0" max="100"/></div>
                </div>
                <Button onClick={handleInternalAddStageToVersion} className="w-full mt-4 font-black uppercase"><PlusCircle className="mr-2 h-4 w-4"/> Add Stage to Path</Button>
            </div>

            <Separator/>
            
            <h4 className="font-black uppercase text-xs tracking-widest text-primary">Stages Sequence (Drag to Reorder)</h4>
             <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleInternalReorderStages}>
                <SortableContext items={editedVersion.stages.map(s => s.id)} strategy={verticalListSortingStrategy}>
                <Accordion type="single" collapsible className="w-full">
                    {editedVersion.stages.sort((a,b) => a.order - b.order).map((stage) => (
                    <WorkflowStageConfigItem
                        key={stage.id}
                        stage={stage}
                        workflowVersionId={editedVersion.id}
                        onStageChange={handleInternalStageChange}
                        onRemoveStage={handleInternalRemoveStage}
                        onAddRequiredDocument={handleInternalAddReqDoc}
                        onUpdateRequiredDocument={handleInternalUpdateReqDoc}
                        onRemoveRequiredDocument={handleInternalRemoveReqDoc}
                        onAddStatus={handleInternalAddStatus}
                        onRemoveStatus={handleInternalRemoveStatus}
                    />
                    ))}
                </Accordion>
                </SortableContext>
            </DndContext>
        </div>
        <DialogFooter className="mt-auto pt-4 border-t gap-3">
          <DialogClose asChild><Button variant="outline" className="font-bold">Cancel</Button></DialogClose>
          <Button onClick={handleSave} className="font-black uppercase bg-primary text-primary-foreground"><Save className="mr-2 h-4 w-4"/> Commit Version Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Component: Main Settings Page ---

export default function SettingsPage() {
  const { toast } = useToast();
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSavingAll, setIsSavingAll] = useState(false);
  
  const [workflowDefinitions, setWorkflowDefinitions] = useState<WorkflowDefinition[]>([]);
  const [departments, setDepartments] = useState<DepartmentObject[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);
  
  const [expandedPaths, setExpandedPaths] = useState<string[]>([]);
  const [isEditVersionDialogOpen, setIsEditVersionDialogOpen] = useState(false);
  const [currentWorkflowDefForEdit, setCurrentWorkflowDefForEdit] = useState<WorkflowDefinition | null>(null);
  const [currentVersionToEdit, setCurrentVersionToEdit] = useState<WorkflowVersion | null>(null);

  // Form states
  const [newParentSectorName, setNewParentSectorName] = useState('');
  const [newRequestTypeName, setNewRequestTypeName] = useState('');
  const [newWorkflowForm, setNewWorkflowForm] = useState({
    name: '',
    departmentId: '',
    parentSectorId: '',
    childSectorId: '',
    description: '',
    insertMode: 'after' as 'before' | 'after',
    referenceId: ''
  });

  const canManageWorkflows = currentUser?.permissions.includes(PERMISSIONS.MANAGE_SETTINGS_WORKFLOWS);

  const fetchData = useCallback(async () => {
    if (!canManageWorkflows) { setIsLoadingData(false); return; }
    setIsLoadingData(true);
    try {
      const [wf, depts, sect, rTypes] = await Promise.all([
        getWorkflowDefinitions(), getDepartments(), getSectors(), getRequestTypes()
      ]);
      setWorkflowDefinitions((wf.workflows || []).sort((a,b) => (a.order || 0) - (b.order || 0)));
      setDepartments(depts.departments || []);
      setSectors(sect.sectors || []);
      setRequestTypes(rTypes.requestTypes as RequestType[] || []);
      
      const parents = sect.sectors?.filter(s => !s.parentId) || [];
      setExpandedPaths(parents.map(s => `path-${s.id}`));
    } catch (e) { console.error(e); }
    finally { setIsLoadingData(false); }
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
    return grouped;
  }, [workflowDefinitions]);

  const referenceWfOptions = useMemo(() => {
    if (!newWorkflowForm.parentSectorId) return [];
    return workflowDefinitions.filter(wf => wf.parentSectorId === newWorkflowForm.parentSectorId);
  }, [workflowDefinitions, newWorkflowForm.parentSectorId]);

  const handleAddParentSector = async () => {
    if (!newParentSectorName.trim()) return;
    const result = await addSector(newParentSectorName.trim(), null);
    if (!result.error) {
      setNewParentSectorName('');
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

  const handleAddWorkflowDefinition = () => {
    const { name, departmentId, parentSectorId, childSectorId, description, insertMode, referenceId } = newWorkflowForm;
    if (!name || !departmentId || !parentSectorId || !childSectorId) {
      toast({ title: "Validation Error", description: "Please fill all required fields.", variant: "destructive" });
      return;
    }

    const parent = parentSectors.find(s => s.id === parentSectorId);
    const child = childSectors.find(s => s.id === childSectorId);
    const dept = departments.find(d => d.id === departmentId);

    const newWf: WorkflowDefinition = {
      id: `wf-def-new-${Date.now()}`,
      name,
      description,
      departmentId,
      departmentName: dept?.name || '',
      sectorId: childSectorId,
      sectorName: child?.name || '',
      parentSectorId,
      parentSectorName: parent?.name || '',
      versions: [],
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    let updatedList = [...workflowDefinitions];
    if (referenceId) {
      const idx = updatedList.findIndex(wf => wf.id === referenceId);
      const targetIdx = insertMode === 'after' ? idx + 1 : idx;
      updatedList.splice(targetIdx, 0, newWf);
    } else {
      updatedList.push(newWf);
    }

    setWorkflowDefinitions(updatedList.map((wf, i) => ({ ...wf, order: i })));
    setNewWorkflowForm({ ...newWorkflowForm, name: '', description: '' });
    toast({ title: "Workflow Added Locally", description: "Click Save to persist changes." });
  };

  const handleSaveVersion = (definitionId: string, updatedVersion: WorkflowVersion) => {
    if (!canManageWorkflows) return;
    setWorkflowDefinitions(prevDefs => prevDefs.map(def => {
      if (def.id === definitionId) {
        let versionsForThisDef = def.versions.map(v => v.id === updatedVersion.id ? updatedVersion : v);
        return { ...def, versions: versionsForThisDef.sort((a,b) => b.versionNumber - a.versionNumber) };
      }
      return def;
    }));
    toast({title: "Version Changes Applied (Local)", description: `Version ${updatedVersion.versionNumber} changes staged. Save all settings to persist.`});
  };

  const handleActivateWorkflowVersion = (definitionId: string, versionId: string) => {
    if (!canManageWorkflows) return;
    setWorkflowDefinitions(prevDefs => prevDefs.map(def => {
        if (def.id === definitionId) {
            return {
                ...def,
                versions: def.versions.map(v => 
                    v.id === versionId ? { ...v, isActive: !v.isActive } : v
                )
            };
        }
        return def;
    }));
    toast({ title: "Status Toggled", description: `Click "Save All Settings" to persist database changes.` });
  };

  const handleOpenEditVersionDialog = (def: WorkflowDefinition, version: WorkflowVersion | null) => {
    if (!canManageWorkflows) return;
    setCurrentWorkflowDefForEdit(def);
    setCurrentVersionToEdit(version);
    setIsEditVersionDialogOpen(true);
  };

  const handleSaveAll = async () => {
    setIsSavingAll(true);
    const result = await saveWorkflowDefinitions(workflowDefinitions);
    if (!result.error) {
      toast({ title: "Success", description: "Settings saved to database." });
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
          <p className="text-muted-foreground font-medium">Manage sectors, request types, and high-fidelity workflow paths.</p>
        </div>
        <Button onClick={handleSaveAll} disabled={isSavingAll} className="bg-primary text-primary-foreground font-black uppercase h-12 px-8 shadow-lg">
          {isSavingAll ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
          Save All Settings to Database
        </Button>
      </div>

      {/* Quick Access Area */}
      <section className="space-y-4">
        <h2 className="text-xs font-black flex items-center gap-2 text-primary uppercase tracking-[0.2em]"><ShieldAlert className="h-4 w-4"/> Administrative Areas</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/settings/departments"><Button variant="outline" size="sm" className="font-bold border-primary/20 hover:bg-primary/5 h-10">Manage Departments</Button></Link>
          <Link href="/settings/branches"><Button variant="outline" size="sm" className="font-bold border-primary/20 hover:bg-primary/5 h-10">Manage Branches</Button></Link>
          <Link href="/settings/roles-management"><Button variant="outline" size="sm" className="font-bold border-primary/20 hover:bg-primary/5 h-10">Manage Roles</Button></Link>
          <Link href="/settings/user-assignments"><Button variant="outline" size="sm" className="font-bold border-primary/20 hover:bg-primary/5 h-10">User Assignments</Button></Link>
          <Link href="/settings/register-user"><Button variant="outline" size="sm" className="font-bold border-primary/20 hover:bg-primary/5 h-10">Register User</Button></Link>
        </div>
      </section>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Manage Sectors */}
        <Card className="lg:col-span-2 shadow-sm border-primary/10">
          <CardHeader className="bg-muted/30 border-b border-primary/5">
            <CardTitle className="text-lg font-black flex items-center gap-2 text-primary uppercase tracking-wider"><Map className="h-5 w-5"/> Manage Sectors</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="flex gap-2 items-end">
              <div className="flex-grow">
                <Label className="text-[10px] font-black uppercase mb-1.5 block text-primary/70">New Parent Sector</Label>
                <Input placeholder="e.g. Service & Mining Sector" value={newParentSectorName} onChange={e => setNewParentSectorName(e.target.value)} className="h-11" />
              </div>
              <Button onClick={handleAddParentSector} disabled={!newParentSectorName.trim()} className="h-11 font-bold px-6">Add</Button>
            </div>
            
            <Accordion type="multiple" className="w-full space-y-2">
              {parentSectors.map(p => (
                <AccordionItem key={p.id} value={p.id} className="border rounded-lg bg-card overflow-hidden">
                  <AccordionTrigger className="hover:no-underline px-4 py-3 bg-muted/10">
                    <div className="flex items-center gap-3">
                      <span className="font-black text-sm uppercase tracking-tight">{p.name}</span>
                      <Badge variant="outline" className="text-[10px] font-bold border-primary/20">{childSectors.filter(c => c.parentId === p.id).length} Sub-Sectors</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-4 space-y-3 bg-background">
                    {childSectors.filter(c => c.parentId === p.id).map(c => (
                      <div key={c.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/30 group">
                        <span className="text-sm font-medium text-foreground/80">• {c.name}</span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7"><Edit className="h-3.5 w-3.5"/></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5"/></Button>
                        </div>
                      </div>
                    ))}
                    <div className="pt-4 flex justify-end gap-2 border-t mt-4">
                       <Button variant="ghost" size="sm" className="text-xs font-bold h-8"><Edit className="mr-1.5 h-3.5 w-3.5"/> Edit Parent</Button>
                       <Button variant="ghost" size="sm" className="text-xs font-bold text-destructive h-8"><Trash2 className="mr-1.5 h-3.5 w-3.5"/> Delete Parent</Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        {/* Request Types */}
        <Card className="shadow-sm border-primary/10">
          <CardHeader className="bg-muted/30 border-b border-primary/5">
            <CardTitle className="text-lg font-black flex items-center gap-2 text-primary uppercase tracking-wider"><Network className="h-5 w-5"/> Request Types</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="flex gap-2 items-end">
              <div className="flex-grow">
                <Input placeholder="e.g. Restructuring" value={newRequestTypeName} onChange={e => setNewRequestTypeName(e.target.value)} className="h-11" />
              </div>
              <Button onClick={handleAddRequestType} disabled={!newRequestTypeName.trim()} className="h-11 font-bold px-6">Add</Button>
            </div>
            <div className="space-y-2 min-h-[300px]">
              {requestTypes.map(rt => (
                <div key={rt.id} className="flex items-center justify-between p-3 rounded-md border bg-card group">
                  <span className="text-sm font-bold uppercase tracking-tight">{rt.name}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7"><Edit className="h-3.5 w-3.5"/></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5"/></Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Workflow Form */}
      <Card className="shadow-sm border-primary/10">
        <CardHeader className="bg-muted/30 border-b border-primary/5">
          <CardTitle className="text-lg font-black flex items-center gap-2 text-primary uppercase tracking-wider"><PlusCircle className="h-5 w-5"/> Define New Workflow Path</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-5">
              <div><Label className="text-[10px] uppercase font-bold text-primary/70">Workflow Name</Label><Input value={newWorkflowForm.name} onChange={e => setNewWorkflowForm({...newWorkflowForm, name: e.target.value})} placeholder="e.g. SME Credit Line" className="h-11" /></div>
              <div>
                <Label className="text-[10px] uppercase font-bold text-primary/70">Parent Sector Path</Label>
                <Select value={newWorkflowForm.parentSectorId} onValueChange={v => setNewWorkflowForm({...newWorkflowForm, parentSectorId: v, referenceId: ''})}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Select Parent Sector"/></SelectTrigger>
                  <SelectContent>{parentSectors.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-[10px] uppercase font-bold text-primary/70">Description</Label><Textarea value={newWorkflowForm.description} onChange={e => setNewWorkflowForm({...newWorkflowForm, description: e.target.value})} placeholder="Purpose of this path component..." rows={4} className="resize-none" /></div>
            </div>
            <div className="space-y-5">
              <div>
                <Label className="text-[10px] uppercase font-bold text-primary/70">Owning Department</Label>
                <Select value={newWorkflowForm.departmentId} onValueChange={v => setNewWorkflowForm({...newWorkflowForm, departmentId: v})}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Select Department"/></SelectTrigger>
                  <SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] uppercase font-bold text-primary/70">Child Sector Alignment</Label>
                <Select value={newWorkflowForm.childSectorId} onValueChange={v => setNewWorkflowForm({...newWorkflowForm, childSectorId: v})} disabled={!newWorkflowForm.parentSectorId}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Select Sub-Sector"/></SelectTrigger>
                  <SelectContent>{childSectors.filter(c => c.parentId === newWorkflowForm.parentSectorId).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-[10px] uppercase font-bold text-primary/70">Position</Label>
                  <Select value={newWorkflowForm.insertMode} onValueChange={v => setNewWorkflowForm({...newWorkflowForm, insertMode: v as 'before' | 'after'})}>
                    <SelectTrigger className="h-11"><SelectValue/></SelectTrigger>
                    <SelectContent><SelectItem value="after">Insert After</SelectItem><SelectItem value="before">Insert Before</SelectItem></SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] uppercase font-bold text-primary/70">Reference Point</Label>
                  <Select value={newWorkflowForm.referenceId} onValueChange={v => setNewWorkflowForm({...newWorkflowForm, referenceId: v})} disabled={!newWorkflowForm.parentSectorId}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Relative To..."/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Initial (Top of List)</SelectItem>
                      {referenceWfOptions.map(wf => <SelectItem key={wf.id} value={wf.id}>{wf.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleAddWorkflowDefinition} className="w-full h-12 font-black uppercase text-primary-foreground bg-primary shadow-lg"><PlusCircle className="mr-2 h-5 w-5"/> Create Definition</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workflow Definitions Visual Paths */}
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-black uppercase tracking-[0.2em] text-primary flex items-center gap-3">
            <Network className="h-6 w-6" /> Current workflow paths
          </h2>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setExpandedPaths(parentSectors.map(s => `path-${s.id}`))} className="text-[10px] font-black uppercase h-8 px-3 border border-primary/20"><Eye className="h-3.5 w-3.5 mr-1.5"/> Expand All</Button>
            <Button variant="ghost" size="sm" onClick={() => setExpandedPaths([])} className="text-[10px] font-black uppercase h-8 px-3 border border-primary/20"><EyeOff className="h-3.5 w-3.5 mr-1.5"/> Collapse All</Button>
          </div>
        </div>

        <Accordion type="multiple" value={expandedPaths} onValueChange={setExpandedPaths} className="space-y-8">
          {parentSectors.map(parent => {
            const pathWorkflows = workflowsByParent[parent.id] || [];
            if (pathWorkflows.length === 0) return null;

            return (
              <AccordionItem key={parent.id} value={`path-${parent.id}`} className="border-none">
                <div className="bg-primary/5 rounded-2xl border border-primary/10 overflow-hidden shadow-sm">
                  <AccordionTrigger className="hover:no-underline px-6 py-5 border-b border-primary/10 bg-primary/10 font-black uppercase text-primary">
                    <div className="flex items-center gap-4">
                      <Briefcase className="h-6 w-6"/>
                      <span>Path for {parent.name}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-6 space-y-10">
                    {/* Visual Sequence Bar */}
                    <div className="flex items-center w-full overflow-x-auto gap-0 pb-6 scrollbar-thin scrollbar-thumb-primary/20">
                      {pathWorkflows.map((wf, idx) => (
                        <React.Fragment key={wf.id}>
                          <div className="flex flex-col items-center min-w-[180px] text-center gap-3 group relative px-4">
                            <div className="z-10 flex h-12 w-12 items-center justify-center rounded-full border-4 border-white bg-primary font-black text-lg text-primary-foreground shadow-lg transition-transform group-hover:scale-110">
                              {idx + 1}
                            </div>
                            <div className="space-y-1">
                              <p className="text-[11px] font-black uppercase text-primary line-clamp-1">{wf.name.split('–')[0]}</p>
                              <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-70 line-clamp-1">{wf.sectorName}</p>
                            </div>
                          </div>
                          {idx < pathWorkflows.length - 1 && (
                            <div className="h-[2px] min-w-[40px] flex-grow bg-primary/20 mt-6" />
                          )}
                        </React.Fragment>
                      ))}
                    </div>

                    {/* Detailed Cards */}
                    <div className="space-y-4">
                      {pathWorkflows.map((wf, idx) => {
                        const activeVer = wf.versions.find(v => v.isActive);
                        return (
                          <Card key={wf.id} className="shadow-md hover:border-primary/30 transition-all">
                            <CardContent className="p-5 flex flex-col md:flex-row justify-between gap-6">
                              <div className="flex items-start gap-6">
                                <div className="mt-1 text-3xl font-black text-primary/10 min-w-[40px]">{idx + 1}.</div>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-3">
                                    <h4 className="font-black text-xl text-foreground uppercase tracking-tight">{wf.name}</h4>
                                    <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-black uppercase">Active</Badge>
                                  </div>
                                  <div className="flex flex-col gap-1.5 text-xs font-bold text-muted-foreground">
                                    <div className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-primary/60"/> Owning Dept: <span className="text-foreground">{wf.departmentName}</span></div>
                                    <div className="flex items-center gap-2"><ArrowRight className="h-3.5 w-3.5 text-primary/60"/> Target: <span className="text-foreground">{wf.sectorName}</span></div>
                                  </div>
                                  <p className="text-xs italic text-muted-foreground font-medium mt-3 leading-relaxed">{wf.description}</p>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-3 shrink-0">
                                <Button variant="ghost" size="sm" className="h-8 text-[10px] font-black uppercase hover:text-primary gap-1.5"><Edit3 className="h-3.5 w-3.5"/> Edit Definition</Button>
                                <div className="flex items-center gap-3">
                                  {activeVer && (
                                    <Badge variant="outline" className="h-10 px-4 font-black uppercase text-xs border-primary/20 bg-primary/5 text-primary">
                                      Version {activeVer.versionNumber} ({activeVer.stages.length} Stages)
                                    </Badge>
                                  )}
                                  <Button variant="ghost" size="sm" className="h-10 text-xs font-black uppercase text-orange-700 hover:bg-orange-50" onClick={() => handleActivateWorkflowVersion(wf.id, activeVer?.id || '')}>{activeVer?.isActive ? 'Deactivate' : 'Activate'}</Button>
                                  <Button size="sm" onClick={() => handleOpenEditVersionDialog(wf, activeVer || null)} className="h-10 px-5 font-black uppercase text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"><PlusCircle className="mr-2 h-4 w-4"/> Edit Stages</Button>
                                </div>
                                <Button variant="link" size="sm" className="h-6 p-0 text-[10px] font-black uppercase text-muted-foreground underline decoration-primary/30">View Version History</Button>
                              </div>
                            </CardContent>
                          </Card>
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

      <EditWorkflowVersionDialog 
        isOpen={isEditVersionDialogOpen} 
        onOpenChange={setIsEditVersionDialogOpen} 
        workflowDefinition={currentWorkflowDefForEdit} 
        versionToEdit={currentVersionToEdit} 
        onSaveVersion={handleSaveVersion} 
        departmentName={currentWorkflowDefForEdit?.departmentName || ''}
      />
    </div>
  );
}
