
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Check, PlusCircle, Trash2, AlertTriangle, Save, Clock, GripVertical, FileText, Users, Percent, Copy, Eye, Edit, History, Type as TypeIcon, ShieldCheck, ShieldOff, Loader2, ShieldAlert, ArrowLeft, ArrowRight, MoreVertical, ChevronDown, ChevronUp, Map, Briefcase, Network, UserCog } from 'lucide-react';
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
import { getWorkflowDefinitions, saveWorkflowDefinitions, getDepartments, addWorkflowDefinition } from '@/services/loan-service-prisma';
import { getSectors, addSector, deleteSector, updateSector, getRequestTypes, addRequestType, deleteRequestType, updateRequestType } from '@/services/sector-and-request-type-service';
import { getRoles, type AppRole } from '@/services/role-service';
import type { ConfigurableListItem } from '@/services/sector-and-request-type-service';
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
  availableStatuses: { [departmentName]: ['Initiated', 'In Progress', 'Completed', 'Pending', 'Not Visited','Returned'] },
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
  departments: DepartmentObject[];
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

  const handleToggleRole = (roleName: string, checked: boolean) => {
    const currentRoles = stage.allowedRoles || [];
    const updatedRoles = checked 
        ? [...currentRoles, roleName]
        : currentRoles.filter(r => r !== roleName);
    onStageChange(workflowVersionId, stage.id, 'allowedRoles', updatedRoles);
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
          <div><Label htmlFor={`s-name-${stage.id}`}>Stage Name</Label><Input id={`s-name-${stage.id}`} value={stage.name} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onChange={(e) => onStageChange(workflowVersionId, stage.id, 'name', e.target.value)} className="mt-1"/></div>
          <div><Label>Responsible Department</Label><Input value={stage.responsibleDepartment} className="mt-1" disabled /></div>
          <div><Label htmlFor={`s-time-${stage.id}`}>Timeline (days)</Label><Input id={`s-time-${stage.id}`} type="number" value={stage.defaultTimelineDays} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onChange={(e) => onStageChange(workflowVersionId, stage.id, 'defaultTimelineDays', parseInt(e.target.value,10) || 0)} className="mt-1" min="0"/></div>
          <div className="flex items-center space-x-2 pt-6">
            <Switch 
                id={`s-approval-${stage.id}`} 
                checked={stage.requiresApproval} 
                onCheckedChange={(v) => onStageChange(workflowVersionId, stage.id, 'requiresApproval', v)}
            />
            <Label htmlFor={`s-approval-${stage.id}`} className="cursor-pointer">Requires Manager Approval</Label>
          </div>
        </div>

        <Separator />
        
        <div>
            <h5 className="text-md font-medium mb-3 flex items-center gap-2"><UserCog className="h-4 w-4 text-primary"/> Allowed Roles to Process this Stage</h5>
            <p className="text-xs text-muted-foreground mb-3">If no roles are selected, any assigned user in the department can act. If roles are selected, only users with those roles can act.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 bg-muted/20 p-3 rounded-md">
                {allRoles.map(role => (
                    <div key={role.id} className="flex items-center space-x-2">
                        <Checkbox 
                            id={`role-${stage.id}-${role.id}`} 
                            checked={(stage.allowedRoles || []).includes(role.name)}
                            onCheckedChange={(checked) => handleToggleRole(role.name, !!checked)}
                        />
                        <Label htmlFor={`role-${stage.id}-${role.id}`} className="text-sm font-normal cursor-pointer">{role.name}</Label>
                    </div>
                ))}
            </div>
        </div>

        <Separator />
        <div>
            <h5 className="text-md font-medium mb-2">Required Documents for this Stage</h5>
            {stage.documentRequirements.length === 0 && (<p className="text-sm text-muted-foreground">No documents required.</p>)}
            <div className="space-y-3">
              {stage.documentRequirements.map((req) => (
                <div key={req.id} className="p-3 border rounded-md grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                  <Input value={req.name} onChange={(e) => onUpdateRequiredDocument(workflowVersionId, stage.id, { ...req, name: e.target.value })} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} placeholder="Requirement Name"/>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2"><Checkbox id={`req-mandatory-${req.id}`} checked={req.isMandatory} onCheckedChange={(checked) => onUpdateRequiredDocument(workflowVersionId, stage.id, { ...req, isMandatory: !!checked })} /><Label htmlFor={`req-mandatory-${req.id}`}>Mandatory</Label></div>
                     <Select value={req.type} onValueChange={(value) => onUpdateRequiredDocument(workflowVersionId, stage.id, { ...req, type: value as DocumentRequirementType })}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent><SelectItem value={DocumentRequirementType.UPLOAD}>Upload</SelectItem><SelectItem value={DocumentRequirementType.CHECKBOX}>Checkbox</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end"><Button variant="ghost" size="icon" onClick={() => onRemoveRequiredDocument(workflowVersionId, stage.id, req.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
                </div>
              ))}
            </div>
            <div className="flex items-end gap-2 mt-4">
                <div className="flex-grow">
                <Label htmlFor={`new-req-doc-${stage.id}`}>New Document Name</Label>
                <Input id={`new-req-doc-${stage.id}`} value={newReqDocName} onChange={(e) => setNewReqDocName(e.target.value)} placeholder="e.g., Passport" className="mt-1" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}/>
                </div>
                <Button onClick={handleAddDoc} size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Add Document Requirement</Button>
            </div>
        </div>

        <Separator />
        <div>
          <h5 className="text-md font-medium mb-2">Available Statuses for <span className="font-bold text-primary">{departmentForStatus}</span> Department</h5>
          <ul className="space-y-2">
            {(stage.availableStatuses?.[departmentForStatus] || []).map((statusName, index) => (
              <li key={`${stage.id}-status-${departmentForStatus}-${index}`} className="flex items-center gap-2 p-2 border rounded-md">
                <span className="flex-grow text-sm">{statusName}</span>
                <Button variant="ghost" size="icon" onClick={() => onRemoveStatus(workflowVersionId, stage.id, departmentForStatus, statusName)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </li>
            ))}
          </ul>
          <div className="flex items-end gap-2 mt-4">
            <div className="flex-grow">
              <Label htmlFor={`new-status-name-${stage.id}`}>New Status Name</Label>
              <Input id={`new-status-name-${stage.id}`} value={newStatusName} onChange={(e) => setNewStatusName(e.target.value)} placeholder="e.g., On Hold" className="mt-1" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}/>
            </div>
            <Button onClick={handleAddStatus} size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Add Status</Button>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => onRemoveStage(workflowVersionId, stage.id)} className="mt-4 text-destructive border-destructive hover:bg-destructive/10"><Trash2 className="mr-2 h-4 w-4" /> Remove Stage From Version</Button>
      </AccordionContent>
    </AccordionItem>
  );
}

interface EditWorkflowVersionDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  workflowDefinition: WorkflowDefinition | null;
  versionToEdit: WorkflowVersion | null;
  departments: DepartmentObject[];
  allRoles: AppRole[];
  onSaveVersion: (definitionId: string, version: WorkflowVersion) => void;
  departmentName: string;
}

function EditWorkflowVersionDialog({
  isOpen, onOpenChange, workflowDefinition, versionToEdit, onSaveVersion, departmentName, allRoles
}: EditWorkflowVersionDialogProps) {
  const [editedVersion, setEditedVersion] = useState<WorkflowVersion | null>(null);
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const { toast } = useToast();

  const [newStageName, setNewStageName] = useState('');
  const [newStageTimeline, setNewStageTimeline] = useState(3);
  const [newStageWeight, setNewStageWeight] = useState(10);
  
  const [newStageDocReqs, setNewStageDocReqs] = useState<DocumentRequirement[]>([]);
  const [newStageStatuses, setNewStageStatuses] = useState<string[]>(['Initiated', 'In Progress', 'Completed', 'Pending', 'Not Visited','Returned']);
  
  const [newDocReqName, setNewDocReqName] = useState('');
  const [newDocReqIsMandatory, setNewDocReqIsMandatory] = useState(true);
  const [newDocReqType, setNewDocReqType] = useState<DocumentRequirementType>(DocumentRequirementType.UPLOAD);
  const [newStatusName, setNewStatusName] = useState('');


  useEffect(() => {
    if (versionToEdit) {
      const versionWithStatusesAndReqs = {
        ...versionToEdit,
        stages: versionToEdit.stages.map(s => ({
          ...s,
          availableStatuses: s.availableStatuses || {},
          documentRequirements: s.documentRequirements || [],
          allowedRoles: s.allowedRoles || [],
          requiresApproval: s.requiresApproval !== undefined ? s.requiresApproval : true,
        })),
      };
      setEditedVersion(JSON.parse(JSON.stringify(versionWithStatusesAndReqs)));
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
  
  const handleInternalAddStageToVersion = (deptName: string) => {
    if (!editedVersion || !workflowDefinition) return;
    if(!newStageName.trim()){
        toast({ title: "Error", description: "New stage name is required.", variant: "destructive"});
        return;
    }
    
    const newOrder = editedVersion.stages.length;
    const newStage = createNewStage(newStageName, deptName, newStageTimeline, newStageWeight, newOrder);
    
    newStage.documentRequirements = newStageDocReqs;
    newStage.availableStatuses = { [deptName]: newStageStatuses };
    
    setEditedVersion(prev => {
      if (!prev) return null;
      return { ...prev, stages: updateStageOrder([...prev.stages, newStage]) };
    });

    setNewStageName('');
    setNewStageTimeline(3);
    setNewStageWeight(10);
    setNewStageDocReqs([]);
    setNewStageStatuses(['Initiated', 'In Progress', 'Completed', 'Pending', 'Not Visited','Returned']);
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
            availableStatuses: {
              ...s.availableStatuses,
              [department]: [...currentStatuses, statusName]
            }
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
            availableStatuses: {
              ...s.availableStatuses,
              [department]: currentStatuses.filter(name => name !== statusName)
            }
          };
        })
      };
    });
  };


  const handleSave = () => {
    if (workflowDefinition && editedVersion) {
      onSaveVersion(workflowDefinition.id, editedVersion);
      onOpenChange(false);
    }
  };

  if (!workflowDefinition || !editedVersion) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Workflow Version {editedVersion.versionNumber} for: {workflowDefinition.name}</DialogTitle>
          <DialogDescription>
            Configure stages, roles, and approval requirements for this version.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto pr-2 space-y-4 py-4">
            <Separator/>
            <h4 className="font-medium">Stages in this Version (Sorted by Order)</h4>
             <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleInternalReorderStages}>
                <SortableContext items={editedVersion.stages.map(s => s.id)} strategy={verticalListSortingStrategy}>
                <Accordion type="single" collapsible className="w-full">
                    {editedVersion.stages.sort((a,b) => a.order - b.order).map((stage) => (
                    <WorkflowStageConfigItem
                        key={stage.id}
                        stage={stage}
                        workflowVersionId={editedVersion.id}
                        departments={[]}
                        allRoles={allRoles}
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
            <Separator />
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <h5 className="font-medium text-lg">Add New Stage to this Version</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                    <div className="sm:col-span-2"><Label htmlFor="new-s-name">Stage Name</Label><Input id="new-s-name" value={newStageName} onChange={e=>setNewStageName(e.target.value)} placeholder="New Stage Name" /></div>
                    <div><Label htmlFor="new-s-time">Timeline (days)</Label><Input id="new-s-time" type="number" value={newStageTimeline} onChange={e=>setNewStageTimeline(parseInt(e.target.value,10)||0)} min="0"/></div>
                    <div><Label htmlFor="new-s-weight">Weight (%)</Label><Input id="new-s-weight" type="number" value={newStageWeight} onChange={e=>setNewStageWeight(parseInt(e.target.value,10)||0)} min="0" max="100"/></div>
                </div>
                
                <Separator/>
                
                <div className="space-y-2">
                    <h6 className="font-medium">Document Requirements for New Stage</h6>
                    {newStageDocReqs.map((req, index) => (
                        <div key={index} className="flex items-center justify-between gap-2 p-2 border rounded-md bg-background">
                            <div className="flex flex-col">
                                <span className="font-medium text-sm">{req.name}</span>
                                <span className="text-xs text-muted-foreground">{req.type} - {req.isMandatory ? 'Mandatory' : 'Optional'}</span>
                            </div>
                           <Button variant="ghost" size="icon" onClick={() => setNewStageDocReqs(prev => prev.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                    ))}
                     <div className="flex flex-col sm:flex-row items-end gap-2 pt-2">
                       <div className="flex-grow w-full"><Label htmlFor="add-new-req-name" className="sr-only">New Doc Name</Label><Input id="add-new-req-name" value={newDocReqName} onChange={e => setNewDocReqName(e.target.value)} placeholder="e.g., Passport Copy" /></div>
                       <div className="flex items-center gap-4">
                         <div className="flex items-center space-x-2">
                            <Checkbox id="add-new-req-mandatory" checked={newDocReqIsMandatory} onCheckedChange={(checked) => setNewDocReqIsMandatory(!!checked)} />
                            <Label htmlFor="add-new-req-mandatory">Mandatory</Label>
                         </div>
                         <Select value={newDocReqType} onValueChange={(value) => setNewDocReqType(value as DocumentRequirementType)}>
                           <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                           <SelectContent><SelectItem value={DocumentRequirementType.UPLOAD}>Upload</SelectItem><SelectItem value={DocumentRequirementType.CHECKBOX}>Checkbox</SelectItem></SelectContent>
                         </Select>
                         <Button type="button" size="sm" onClick={() => { if(newDocReqName.trim()) { setNewStageDocReqs(prev => [...prev, createNewDocumentRequirement(newDocReqName.trim(), newDocReqIsMandatory, newDocReqType)]); setNewDocReqName(''); }}}>
                           <PlusCircle className="mr-2 h-4 w-4"/> Add
                         </Button>
                       </div>
                    </div>
                </div>
                
                <Separator/>
                
                <div className="space-y-2">
                     <h6 className="font-medium">Available Statuses for {departmentName}</h6>
                     {newStageStatuses.map((status, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 border rounded-md">
                           <span className="flex-grow text-sm">{status}</span>
                           {index > 2 ? <Button variant="ghost" size="icon" onClick={() => setNewStageStatuses(prev => prev.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4 text-destructive" /></Button> : <span className="text-xs text-muted-foreground">(default)</span>}
                        </div>
                    ))}
                    <div className="flex items-end gap-2">
                       <div className="flex-grow"><Label htmlFor="add-new-status-name" className="sr-only">New Status Name</Label><Input id="add-new-status-name" value={newStatusName} onChange={e => setNewStatusName(e.target.value)} placeholder="e.g., On Hold" /></div>
                       <Button type="button" size="sm" onClick={() => { if(newStatusName.trim() && !newStageStatuses.includes(newStatusName.trim())) { setNewStageStatuses(prev => [...prev, newStatusName.trim()]); setNewStatusName(''); }}}><PlusCircle className="mr-2 h-4 w-4"/> Add</Button>
                    </div>
                </div>
                
                <Button onClick={() => handleInternalAddStageToVersion(departmentName)} className="w-full mt-4"><PlusCircle className="mr-2 h-4 w-4"/>Add Stage to Version</Button>
            </div>
        </div>
        <DialogFooter className="mt-auto pt-4 border-t">
          <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
          <Button type="button" onClick={handleSave}><Save className="mr-2 h-4 w-4"/>Save Version Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


interface EditWorkflowDefinitionDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  definitionToEdit: WorkflowDefinition | null;
  onSave: (updatedDefinition: WorkflowDefinition) => void;
  sectors: Sector[];
  departments: DepartmentObject[];
  isSaving: boolean;
}

function EditWorkflowDefinitionDialog({ isOpen, onOpenChange, definitionToEdit, onSave, sectors, departments, isSaving }: EditWorkflowDefinitionDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentSectorId, setParentSectorId] = useState('');
  const [childSectorId, setChildSectorId] = useState('');
  const [departmentId, setDepartmentId] = useState('');

  const parentSectors = useMemo(() => sectors.filter(s => !s.parentId), [sectors]);
  const childSectors = useMemo(() => {
    if (!parentSectorId) return [];
    return sectors.filter(s => s.parentId === parentSectorId);
  }, [sectors, parentSectorId]);

  useEffect(() => {
    if (definitionToEdit) {
      setName(definitionToEdit.name);
      setDescription(definitionToEdit.description || '');
      setParentSectorId(definitionToEdit.parentSectorId || '');
      setChildSectorId(definitionToEdit.sectorId || '');
      setDepartmentId(definitionToEdit.departmentId || '');
    }
  }, [definitionToEdit]);

  useEffect(() => {
    if (!childSectors.some(cs => cs.id === childSectorId)) {
        setChildSectorId('');
    }
  }, [parentSectorId, childSectors, childSectorId]);

  const handleSave = () => {
    if (!definitionToEdit || !name.trim() || !parentSectorId || !childSectorId || !departmentId) {
      return;
    }
    const updatedDefinition: WorkflowDefinition = {
      ...definitionToEdit,
      name,
      description,
      parentSectorId,
      parentSectorName: parentSectors.find(ps => ps.id === parentSectorId)?.name,
      sectorId: childSectorId,
      sectorName: sectors.find(s => s.id === childSectorId)?.name || '',
      departmentId,
      departmentName: departments.find(d => d.id === departmentId)?.name || '',
    };
    onSave(updatedDefinition);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Workflow Definition</DialogTitle>
          <DialogDescription>Modify the core details of &quot;{definitionToEdit?.name}&quot;.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div><Label htmlFor="edit-wf-name">Workflow Name</Label><Input id="edit-wf-name" value={name} onChange={e => setName(e.target.value)} disabled={isSaving} /></div>
          <div><Label htmlFor="edit-wf-desc">Description</Label><Textarea id="edit-wf-desc" value={description} onChange={e => setDescription(e.target.value)} disabled={isSaving} /></div>
          <div>
            <Label htmlFor="edit-wf-parent-sector">Parent Sector</Label>
            <Select value={parentSectorId} onValueChange={setParentSectorId} disabled={isSaving}><SelectTrigger id="edit-wf-parent-sector"><SelectValue placeholder="Select Parent Sector..." /></SelectTrigger><SelectContent>{parentSectors.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div>
            <Label htmlFor="edit-wf-child-sector">Child Sector</Label>
            <Select value={childSectorId} onValueChange={setChildSectorId} disabled={isSaving || !parentSectorId}><SelectTrigger id="edit-wf-child-sector"><SelectValue placeholder="Select Child Sector..." /></SelectTrigger><SelectContent>{childSectors.length > 0 ? childSectors.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>) : <SelectItem value="none" disabled>No child sectors for this parent</SelectItem>}</SelectContent></Select>
          </div>
          <div>
            <Label htmlFor="edit-wf-dept">Owning Department</Label>
            <Select value={departmentId} onValueChange={setDepartmentId} disabled={isSaving}><SelectTrigger id="edit-wf-dept"><SelectValue placeholder="Select Department..." /></SelectTrigger><SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
          <Button onClick={handleSave} disabled={isSaving || !name.trim() || !parentSectorId || !childSectorId || !departmentId}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


export default function SettingsPage() {
  const { toast } = useToast();
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSavingData, setIsSavingData] = useState(false);
  
  const [workflowDefinitions, setWorkflowDefinitions] = useState<WorkflowDefinition[]>([]);
  const [departments, setDepartments] = useState<DepartmentObject[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  
  const [error, setError] = useState<string | null>(null);

  const [isEditVersionDialogOpen, setIsEditVersionDialogOpen] = useState(false);
  const [currentWorkflowDefForEdit, setCurrentWorkflowDefForEdit] = useState<WorkflowDefinition | null>(null);
  const [currentVersionToEdit, setCurrentVersionToEdit] = useState<WorkflowVersion | null>(null);
  
  const [isEditDefinitionDialogOpen, setIsEditDefinitionDialogOpen] = useState(false);
  const [definitionToEdit, setDefinitionToEdit] = useState<WorkflowDefinition | null>(null);


  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [newWorkflowDepartmentId, setNewWorkflowDepartmentId] = useState('');
  const [newWorkflowParentSectorId, setNewWorkflowParentSectorId] = useState('');
  const [newWorkflowChildSectorId, setNewWorkflowChildSectorId] = useState('');
  const [newWorkflowDescription, setNewWorkflowDescription] = useState('');
  
  const [newWorkflowInsertMode, setNewWorkflowInsertMode] = useState<'before' | 'after'>('after');
  const [newWorkflowReferenceId, setNewWorkflowReferenceId] = useState<string>('');

  const [newParentSectorName, setNewParentSectorName] = useState('');
  const [newChildSectorName, setNewChildSectorName] = useState('');
  const [newChildSectorParentId, setNewChildSectorParentId] = useState<string>('');
  
  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  const [editingSectorName, setEditingSectorName] = useState('');
  const [isEditSectorDialogOpen, setIsEditSectorDialogOpen] = useState(false);
  
  const [newRequestTypeName, setNewRequestTypeName] = useState('');
  const [editingRequestType, setEditingRequestType] = useState<RequestType | null>(null);
  const [editingRequestTypeName, setEditingRequestTypeName] = useState('');
  const [isEditRequestTypeDialogOpen, setIsEditRequestTypeDialogOpen] = useState(false);

  const [isSavingAll, setIsSavingAll] = useState(false);

  const canManageWorkflows = currentUser?.permissions.includes(PERMISSIONS.MANAGE_SETTINGS_WORKFLOWS);

  const fetchInitialData = useCallback(() => {
    if (!canManageWorkflows) {
      setIsLoadingData(false);
      return;
    }
      setIsLoadingData(true);
      setError(null);
      Promise.all([
          getWorkflowDefinitions(),
          getDepartments(),
          getSectors(),
          getRequestTypes(),
          getRoles(),
      ]).then(([wfResult, deptResult, sectorResult, requestTypeResult, roleResult]) => {
          if (wfResult.error) throw new Error(`Workflows: ${wfResult.error}`);
          setWorkflowDefinitions((wfResult.workflows || []).sort((a,b) => (a.order || 0) - (b.order || 0)));

          if (deptResult.error) throw new Error(`Departments: ${deptResult.error}`);
          setDepartments(deptResult.departments || []);

          if (sectorResult.error) throw new Error(`Sectors: ${sectorResult.error}`);
          setSectors(sectorResult.sectors || []);
          
          if (requestTypeResult.error) throw new Error(`Request Types: ${requestTypeResult.error}`);
          setRequestTypes(requestTypeResult.requestTypes as RequestType[] || []);

          if (roleResult.error) throw new Error(`Roles: ${roleResult.error}`);
          setRoles(roleResult.data || []);

          if(deptResult.departments?.length > 0 && newWorkflowDepartmentId === '') setNewWorkflowDepartmentId(deptResult.departments[0].id);
          const pSectors = sectorResult.sectors?.filter(s => !s.parentId) || [];
          if(pSectors.length > 0 && newWorkflowParentSectorId === '') setNewWorkflowParentSectorId(pSectors[0].id);
          if(pSectors.length > 0 && newChildSectorParentId === '') setNewChildSectorParentId(pSectors[0].id);
      }).catch(err => {
        const errorMessage = err.message || "Failed to load settings data.";
        setError(errorMessage);
        toast({title: "Error Loading Settings", description: errorMessage, variant: "destructive", duration: 9000});
      }).finally(() => {
        setIsLoadingData(false);
      });
    }, [canManageWorkflows, toast, newWorkflowDepartmentId, newWorkflowParentSectorId, newChildSectorParentId]);


  useEffect(() => {
    if (!authLoading) {
      fetchInitialData();
    }
  }, [authLoading, fetchInitialData]);
  
  const pSectors = useMemo(() => sectors.filter(s => !s.parentId), [sectors]);
  const childSectorsForSelectedParent = useMemo(() => {
    if (!newWorkflowParentSectorId) return [];
    return sectors.filter(s => s.parentId === newWorkflowParentSectorId);
  }, [sectors, newWorkflowParentSectorId]);

  useEffect(() => {
    setNewWorkflowChildSectorId('');
  }, [newWorkflowParentSectorId]);


  const referenceWorkflowOptions = useMemo(() => {
    return workflowDefinitions
      .filter(wf => wf.parentSectorId === newWorkflowParentSectorId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [workflowDefinitions, newWorkflowParentSectorId]);
  
  useEffect(() => {
    if (referenceWorkflowOptions.length > 0) {
      if (!newWorkflowReferenceId || !referenceWorkflowOptions.some(wf => wf.id === newWorkflowReferenceId)) {
        setNewWorkflowReferenceId(referenceWorkflowOptions[referenceWorkflowOptions.length - 1].id);
      }
    } else {
      setNewWorkflowReferenceId('');
    }
  }, [referenceWorkflowOptions, newWorkflowReferenceId]);


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
    toast({ title: "Success (Local)", description: `Workflow version status toggled.` });
  };
  

  const handleOpenEditVersionDialog = (def: WorkflowDefinition, version: WorkflowVersion) => {
    if (!canManageWorkflows) return;
    setCurrentWorkflowDefForEdit(def);
    setCurrentVersionToEdit(version);
    setIsEditVersionDialogOpen(true);
  };

  const handleAddNewVersion = (definitionId: string) => {
    if (!canManageWorkflows) return;
    setWorkflowDefinitions(prevDefs => prevDefs.map(def => {
      if (def.id === definitionId) {
        const latestVersionNum = def.versions.length > 0 ? Math.max(...def.versions.map(v => v.versionNumber)) : 0;
        const newVersion: WorkflowVersion = {
          id: `wfver-custom-${Date.now()}-${Math.random().toString(36).substring(2,5)}`,
          workflowDefinitionId: def.id,
          versionNumber: latestVersionNum + 1,
          createdAt: new Date().toISOString(),
          stages: [],
          isActive: false, 
        };
        return { ...def, versions: [...def.versions, newVersion].sort((a,b) => b.versionNumber - a.versionNumber) };
      }
      return def;
    }));
    toast({title: "New Version Added (Local)", description: "Empty new version added. Remember to Save All Settings."});
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
     toast({title: "Version Changes Applied (Local)", description: `Version ${updatedVersion.versionNumber} changes staged.`});
  };

  const handleAddNewWorkflowDefinition = async () => {
    if (!canManageWorkflows) return;
    if (!newWorkflowName.trim() || !newWorkflowDepartmentId || !newWorkflowParentSectorId || !newWorkflowChildSectorId) {
        toast({ title: "Validation Error", description: "Workflow name, department, parent sector, and child sector are all required.", variant: "destructive" });
        return;
    }
    
    const parentSector = sectors.find(s => s.id === newWorkflowParentSectorId);
    
    const newWf: Omit<WorkflowDefinition, 'id' | 'versions'> = {
        name: newWorkflowName,
        description: newWorkflowDescription,
        departmentId: newWorkflowDepartmentId,
        departmentName: departments.find(d => d.id === newWorkflowDepartmentId)?.name || 'Unknown',
        sectorId: newWorkflowChildSectorId,
        sectorName: sectors.find(s => s.id === newWorkflowChildSectorId)?.name || 'Unknown',
        parentSectorId: parentSector?.id,
        parentSectorName: parentSector?.name,
        order: 0,
    };
    
    let updatedWfList = [...workflowDefinitions];
    const newWorkflowWithId = { ...newWf, id: `wf-def-custom-${Date.now()}`, versions: [] };
    
    if (referenceWorkflowOptions.length === 0) {
        updatedWfList.push(newWorkflowWithId);
    } else {
        const referenceIndex = updatedWfList.findIndex(wf => wf.id === newWorkflowReferenceId);
        if(referenceIndex === -1) return;
        const insertIndex = newWorkflowInsertMode === 'after' ? referenceIndex + 1 : referenceIndex;
        updatedWfList.splice(insertIndex, 0, newWorkflowWithId);
    }

    setWorkflowDefinitions(updatedWfList.map((wf, index) => ({ ...wf, order: index })));
    setNewWorkflowName('');
    setNewWorkflowDescription('');
    toast({ title: "Workflow Added Locally", description: `"${newWorkflowName}" was added. Save all settings to persist.` });
  };
  
  const handleOpenEditDefinitionDialog = (definition: WorkflowDefinition) => {
    setDefinitionToEdit(definition);
    setIsEditDefinitionDialogOpen(true);
  };
  
  const handleSaveDefinition = (updatedDefinition: WorkflowDefinition) => {
    setWorkflowDefinitions(prev => prev.map(def => def.id === updatedDefinition.id ? updatedDefinition : def));
    toast({title: "Workflow Updated (Local)", description: `Changes for "${updatedDefinition.name}" are staged.`});
  };


  const handleAddSector = async (name: string, parentId: string | null) => {
    if (!canManageWorkflows || !name.trim()) return;
    setIsSavingData(true);
    try {
        const result = await addSector(name.trim(), parentId);
        if (!result.error && result.id) {
            toast({ title: "Success", description: `Sector "${name.trim()}" added.` });
            if (parentId) setNewChildSectorName(''); else setNewParentSectorName('');
            await fetchInitialData();
        } else {
            toast({ title: "Error", description: result.error, variant: "destructive" });
        }
    } catch (error: any) {
        toast({ title: "Action Failed", variant: "destructive" });
    } finally {
        setIsSavingData(false);
    }
  };

  const handleUpdateSector = async () => {
    if (!canManageWorkflows || !editingSector) return;
    setIsSavingData(true);
    try {
        const result = await updateSector(editingSector.id, editingSectorName);
        if (!result.error) {
            toast({ title: "Success", description: "Sector updated." });
            setIsEditSectorDialogOpen(false);
            await fetchInitialData();
        }
    } finally {
        setIsSavingData(false);
    }
  };

  const handleDeleteSector = async (sectorId: string, sectorName: string) => {
    if (!canManageWorkflows) return;
    setIsSavingData(true);
    try {
      const result = await deleteSector(sectorId);
      if (!result.error) {
        toast({ title: "Success", description: `Sector "${sectorName}" deleted.` });
        await fetchInitialData();
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    } finally {
      setIsSavingData(false);
    }
  };
  
    const handleAddRequestType = async () => {
    if (!canManageWorkflows || !newRequestTypeName.trim()) return;
    setIsSavingData(true);
    try {
      const result = await addRequestType(newRequestTypeName.trim());
      if (!result.error) {
        toast({ title: "Success", description: `Request Type added.` });
        setNewRequestTypeName('');
        await fetchInitialData(); 
      }
    } finally {
      setIsSavingData(false);
    }
  };

  const handleDeleteRequestType = async (id: string, name: string) => {
    if (!canManageWorkflows) return;
    setIsSavingData(true);
    try {
      const result = await deleteRequestType(id);
      if (result.success) {
        toast({ title: "Success", description: `Request Type "${name}" deleted.` });
        await fetchInitialData();
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    } finally {
      setIsSavingData(false);
    }
  };

  const handleSaveChanges = async () => {
    setIsSavingAll(true);
    try {
        const result = await saveWorkflowDefinitions(workflowDefinitions);
        if (!result.error) {
            toast({ title: "Settings Saved", description: "Configurations have been persisted." });
            await fetchInitialData();
        } else {
            throw new Error(result.error);
        }
    } catch (err: any) {
        toast({ title: "Saving Failed", description: err.message, variant: "destructive" });
    } finally {
        setIsSavingAll(false);
    }
  };

  if (authLoading || isLoadingData) {
    return (
        <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="ml-3 text-lg">Loading settings...</p>
        </div>
    );
  }

  const workflowsByParentSector = workflowDefinitions.reduce((acc, wf) => {
    const key = wf.parentSectorId || 'unclassified';
    if (!acc[key]) acc[key] = { parentSectorName: wf.parentSectorName || 'Unclassified', workflows: [] };
    acc[key].workflows.push(wf);
    acc[key].workflows.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return acc;
  }, {} as Record<string, { parentSectorName?: string; workflows: WorkflowDefinition[] }>);


  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Configure workflows, sectors, and role-based permissions.</p>
      </div>

       <Card>
        <CardHeader>
          <CardTitle>Administrative Areas</CardTitle>
          <CardDescription>Quick links to other management pages.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
            {currentUser?.permissions.includes(PERMISSIONS.MANAGE_SETTINGS_DEPARTMENTS) && (
              <Link href="/settings/departments" passHref><Button variant="outline">Manage Departments</Button></Link>
            )}
            {currentUser?.permissions.includes(PERMISSIONS.MANAGE_SETTINGS_BRANCHES) && (
              <Link href="/settings/branches" passHref><Button variant="outline">Manage Branches & Districts</Button></Link>
            )}
            {currentUser?.permissions.includes(PERMISSIONS.MANAGE_SETTINGS_ROLES) && (
              <Link href="/settings/roles-management" passHref><Button variant="outline">Manage Roles</Button></Link>
            )}
            {currentUser?.permissions.includes(PERMISSIONS.MANAGE_USERS) && (
              <Link href="/settings/user-assignments" passHref><Button variant="outline">Manage User Assignments</Button></Link>
            )}
            {currentUser?.permissions.includes(PERMISSIONS.MANAGE_USERS) && (
              <Link href="/settings/register-user" passHref><Button variant="outline">Register New User</Button></Link>
            )}
        </CardContent>
      </Card>

    {canManageWorkflows && (
      <>
        <div className="grid lg:grid-cols-2 gap-8 items-start">
            <Card>
                <CardHeader>
                    <CardTitle>Manage Sectors</CardTitle>
                    <CardDescription>Define parent and child business sectors.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="add-parent">
                            <AccordionTrigger>Add Parent Sector</AccordionTrigger>
                            <AccordionContent className="pt-4">
                                <div className="flex gap-2">
                                    <Input placeholder="e.g., Service Industry" value={newParentSectorName} onChange={(e) => setNewParentSectorName(e.target.value)} disabled={isSavingData || isSavingAll} />
                                    <Button onClick={() => handleAddSector(newParentSectorName, null)} disabled={!newParentSectorName.trim() || isSavingData || isSavingAll}>Add</Button>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="add-child">
                            <AccordionTrigger>Add Child Sector</AccordionTrigger>
                            <AccordionContent className="space-y-2 pt-4">
                               <Label>Select Parent Sector</Label>
                                <Select value={newChildSectorParentId} onValueChange={setNewChildSectorParentId}>
                                    <SelectTrigger><SelectValue placeholder="Select a Parent Sector..." /></SelectTrigger>
                                    <SelectContent>{pSectors.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                </Select>
                                <Label>New Child Sector Name</Label>
                                <div className="flex gap-2">
                                    <Input placeholder="e.g., Crop Production" value={newChildSectorName} onChange={(e) => setNewChildSectorName(e.target.value)} disabled={isSavingData || isSavingAll || !newChildSectorParentId} />
                                    <Button onClick={() => handleAddSector(newChildSectorName, newChildSectorParentId)} disabled={!newChildSectorName.trim() || !newChildSectorParentId || isSavingData || isSavingAll}>Add</Button>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                    <Separator className="my-4"/>
                    <div className="space-y-2">
                      {pSectors.map(parent => (
                        <div key={parent.id} className="p-2 border rounded-md">
                            <div className="flex items-center justify-between">
                                <span className="font-semibold">{parent.name}</span>
                                <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => { setEditingSector(parent); setEditingSectorName(parent.name); setIsEditSectorDialogOpen(true); }}><Edit className="h-4 w-4"/></Button>
                                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteSector(parent.id, parent.name)}><Trash2 className="h-4 w-4"/></Button>
                                </div>
                            </div>
                            <div className="pl-4 mt-1 space-y-1">
                                {sectors.filter(s => s.parentId === parent.id).map(child => (
                                    <div key={child.id} className="flex items-center justify-between text-sm py-1">
                                        <span>{child.name}</span>
                                        <div className="flex items-center gap-1">
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingSector(child); setEditingSectorName(child.name); setIsEditSectorDialogOpen(true); }}><Edit className="h-3 w-3"/></Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeleteSector(child.id, child.name)}><Trash2 className="h-3 w-3"/></Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                      ))}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Manage Request Types</CardTitle>
                    <CardDescription>Define loan request types.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2">
                        <Input placeholder="e.g., Additional Facility" value={newRequestTypeName} onChange={(e) => setNewRequestTypeName(e.target.value)} disabled={isSavingData || isSavingAll}/>
                        <Button onClick={handleAddRequestType} disabled={!newRequestTypeName.trim() || isSavingData || isSavingAll}>Add</Button>
                    </div>
                    <Separator className="my-4"/>
                    <div className="space-y-2">
                        {requestTypes.map(item => (
                            <div key={item.id} className="flex items-center justify-between p-2 border rounded-md">
                                <span>{item.name}</span>
                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteRequestType(item.id, item.name)}><Trash2 className="h-4 w-4"/></Button>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>Workflow Definitions</CardTitle>
                <CardDescription>Manage workflows and their versions. Define which roles can act on each stage.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Accordion type="single" collapsible defaultValue="add-new-workflow">
                  <AccordionItem value="add-new-workflow">
                    <AccordionTrigger><span className="flex items-center text-primary font-semibold"><PlusCircle className="mr-2 h-5 w-5"/> Add New Workflow Definition</span></AccordionTrigger>
                    <AccordionContent className="pt-4">
                       <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
                          <div className="grid md:grid-cols-2 gap-4">
                            <div><Label htmlFor="new-wf-name">Workflow Name</Label><Input id="new-wf-name" value={newWorkflowName} onChange={e => setNewWorkflowName(e.target.value)} placeholder="e.g., SME Credit Line" disabled={isSavingAll || isSavingData} /></div>
                            <div>
                              <Label htmlFor="new-wf-dept">Owning Department</Label>
                              <Select value={newWorkflowDepartmentId} onValueChange={setNewWorkflowDepartmentId}>
                                <SelectTrigger id="new-wf-dept"><SelectValue placeholder="Select Department" /></SelectTrigger>
                                <SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="new-wf-parent-sector">For Parent Sector</Label>
                              <Select value={newWorkflowParentSectorId} onValueChange={setNewWorkflowParentSectorId}>
                                <SelectTrigger id="new-wf-parent-sector"><SelectValue placeholder="Select Parent Sector" /></SelectTrigger>
                                <SelectContent>{pSectors.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                             <div>
                              <Label htmlFor="new-wf-child-sector">For Child Sector</Label>
                              <Select value={newWorkflowChildSectorId} onValueChange={setNewWorkflowChildSectorId} disabled={!newWorkflowParentSectorId}>
                                <SelectTrigger id="new-wf-child-sector"><SelectValue placeholder="Select Child Sector" /></SelectTrigger>
                                <SelectContent>{childSectorsForSelectedParent.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                          </div>
                          <Button onClick={handleAddNewWorkflowDefinition} disabled={isSavingAll || isSavingData} className="w-full">Add Workflow Definition</Button>
                        </div>
                    </AccordionContent>
                  </AccordionItem>
              </Accordion>
              
              {Object.values(workflowsByParentSector).map(({ parentSectorName, workflows }) => (
                <div key={parentSectorName} className="space-y-4 pt-4 border-t">
                   <h3 className="text-lg font-bold flex items-center gap-2"><Briefcase className="h-5 w-5 text-primary"/> {parentSectorName} Path</h3>
                   <div className="grid gap-4">
                      {workflows.map(def => (
                        <Card key={def.id} className="shadow-sm">
                            <CardHeader className="flex flex-row justify-between items-start pb-2">
                                <div>
                                    <CardTitle className="text-lg">{def.name}</CardTitle>
                                    <CardDescription>{def.sectorName} | {def.departmentName}</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => handleOpenEditDefinitionDialog(def)}><Edit className="h-4 w-4"/></Button>
                                    <Button variant="outline" size="sm" onClick={() => handleAddNewVersion(def.id)}>+ Version</Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {def.versions.map(version => (
                                  <div key={version.id} className={`flex items-center justify-between p-2 border rounded-md ${version.isActive ? "border-primary bg-primary/5" : "bg-muted/30"}`}>
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-sm">V{version.versionNumber}</span>
                                      {version.isActive && <Badge className="bg-green-600 text-white text-[10px]">Active</Badge>}
                                      <span className="text-[10px] text-muted-foreground">{version.stages.length} Stages</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="ghost" size="sm" onClick={() => handleActivateWorkflowVersion(def.id, version.id)}>{version.isActive ? 'Deactivate' : 'Activate'}</Button>
                                        <Button variant="ghost" size="sm" onClick={() => handleOpenEditVersionDialog(def, version)}><Edit className="h-4 w-4" /></Button>
                                    </div>
                                  </div>
                                ))}
                            </CardContent>
                        </Card>
                      ))}
                   </div>
                </div>
              ))}
            </CardContent>
        </Card>
      </>
      )}
      
      <EditWorkflowVersionDialog 
        isOpen={isEditVersionDialogOpen} 
        onOpenChange={setIsEditVersionDialogOpen} 
        workflowDefinition={currentWorkflowDefForEdit} 
        versionToEdit={currentVersionToEdit} 
        departments={departments} 
        allRoles={roles}
        onSaveVersion={handleSaveVersion} 
        departmentName={currentWorkflowDefForEdit?.departmentName || ''}
      />
      <EditWorkflowDefinitionDialog 
        isOpen={isEditDefinitionDialogOpen} 
        onOpenChange={setIsEditDefinitionDialogOpen} 
        definitionToEdit={definitionToEdit} 
        onSave={handleSaveDefinition} 
        sectors={sectors} 
        departments={departments} 
        isSaving={isSavingAll || isSavingData} 
      />

      <Dialog open={isEditSectorDialogOpen} onOpenChange={setIsEditSectorDialogOpen}>
        <DialogContent>
            <DialogHeader><DialogTitle>Edit Sector</DialogTitle></DialogHeader>
            <div className="py-4"><Label>New Name</Label><Input value={editingSectorName} onChange={(e) => setEditingSectorName(e.target.value)} disabled={isSavingData} /></div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditSectorDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleUpdateSector} disabled={isSavingData}>Save</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex justify-end pt-4"><Button onClick={handleSaveChanges} size="lg" disabled={isSavingAll || isSavingData}>
        {isSavingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        {isSavingAll ? "Saving All..." : "Save All Settings to Database"}
      </Button></div>
    </div>
  );
}
