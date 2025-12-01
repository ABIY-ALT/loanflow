

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Check, PlusCircle, Trash2, AlertTriangle, Save, Clock, GripVertical, FileText, Users, Percent, Copy, Eye, Edit, History, Type as TypeIcon, ShieldCheck, ShieldOff, Loader2, ShieldAlert, ArrowLeft, ArrowRight, MoreHorizontal, ChevronDown, ChevronUp, Map, Briefcase, Network } from 'lucide-react';
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
import { getSectors, addSector, deleteSector, updateSector, getRequestTypes, addRequestType, deleteRequestType, updateRequestType, type ConfigurableListItem } from '@/services/sector-and-request-type-service';
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
  availableStatuses: { [departmentName]: ['Initiated', 'In Progress', 'Completed'] }, // Default statuses
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
            <span>{stage.order + 1}. {stage.name}</span>
          </div>
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Users className="h-4 w-4"/>{stage.responsibleDepartment || 'N/A'} | <Clock className="h-4 w-4"/>{stage.defaultTimelineDays}d | <Percent className="h-4 w-4" />{stage.percentageWeight || 0}% | <FileText className="h-4 w-4"/>{stage.documentRequirements.length} doc(s)
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="space-y-6 p-4 bg-background rounded-b-md">
        <div className="grid md:grid-cols-3 gap-4">
          <div><Label htmlFor={`s-name-${stage.id}`}>Stage Name</Label><Input id={`s-name-${stage.id}`} value={stage.name} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onChange={(e) => onStageChange(workflowVersionId, stage.id, 'name', e.target.value)} className="mt-1"/></div>
          <div><Label>Responsible Department</Label><Input value={stage.responsibleDepartment} className="mt-1" disabled /></div>
          <div><Label htmlFor={`s-time-${stage.id}`}>Timeline (days)</Label><Input id={`s-time-${stage.id}`} type="number" value={stage.defaultTimelineDays} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onChange={(e) => onStageChange(workflowVersionId, stage.id, 'defaultTimelineDays', parseInt(e.target.value,10) || 0)} className="mt-1" min="0"/></div>
          <div><Label htmlFor={`s-weight-${stage.id}`}>Weight (%)</Label><Input id={`s-weight-${stage.id}`} type="number" value={stage.percentageWeight} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onChange={(e) => onStageChange(workflowVersionId, stage.id, 'percentageWeight', parseInt(e.target.value,10) || 0)} className="mt-1" min="0" max="100"/></div>
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
          {(!stage.availableStatuses || !stage.availableStatuses[departmentForStatus] || stage.availableStatuses[departmentForStatus].length === 0) && (
            <p className="text-sm text-muted-foreground">No statuses defined for this department. Add one below.</p>
          )}
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
  
  const [newStageDocReqs, setNewStageDocReqs] = useState<DocumentRequirement[]>([]);
  const [newStageStatuses, setNewStageStatuses] = useState<string[]>(['Initiated', 'In Progress', 'Completed']);
  
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
    
    // Add the doc reqs and statuses from the "add stage" form state
    newStage.documentRequirements = newStageDocReqs;
    newStage.availableStatuses = { [deptName]: newStageStatuses };
    
    setEditedVersion(prev => {
      if (!prev) return null;
      return { ...prev, stages: updateStageOrder([...prev.stages, newStage]) };
    });

    // Reset form
    setNewStageName('');
    setNewStageTimeline(3);
    setNewStageWeight(10);
    setNewStageDocReqs([]);
    setNewStageStatuses(['Initiated', 'In Progress', 'Completed']);
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
          if (currentStatuses.includes(statusName)) return s; // Don't add duplicates
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
      const totalWeight = editedVersion.stages.reduce((sum, stage) => sum + (Number(stage.percentageWeight) || 0), 0);
      if (totalWeight > 100) {
        toast({ title: "Validation Error", description: `Total stage weight (${totalWeight}%) exceeds 100%. Please adjust.`, variant: "destructive"});
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
      <DialogContent className="max-w-3xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Workflow Version {editedVersion.versionNumber} for: {workflowDefinition.name}</DialogTitle>
          <DialogDescription>
            Modify stages for this version. Drag to reorder. Total Stage Weight: <span className={`font-semibold ${currentTotalWeight > 100 ? 'text-destructive' : 'text-green-600'}`}>{currentTotalWeight}% / 100%</span>
            {currentTotalWeight > 100 && <span className="text-destructive ml-2">(Exceeds 100%)</span>}
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
                
                {/* Add Available Statuses section */}
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


export default function SettingsPage() {
  const { toast } = useToast();
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSavingData, setIsSavingData] = useState(false);
  
  const [workflowDefinitions, setWorkflowDefinitions] = useState<WorkflowDefinition[]>([]);
  const [departments, setDepartments] = useState<DepartmentObject[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);
  
  const [error, setError] = useState<string | null>(null);

  const [isEditVersionDialogOpen, setIsEditVersionDialogOpen] = useState(false);
  const [currentWorkflowDefForEdit, setCurrentWorkflowDefForEdit] = useState<WorkflowDefinition | null>(null);
  const [currentVersionToEdit, setCurrentVersionToEdit] = useState<WorkflowVersion | null>(null);

  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [newWorkflowDepartmentId, setNewWorkflowDepartmentId] = useState('');
  const [newWorkflowParentSectorId, setNewWorkflowParentSectorId] = useState('');
  const [newWorkflowChildSectorId, setNewWorkflowChildSectorId] = useState('');
  const [newWorkflowDescription, setNewWorkflowDescription] = useState('');
  
  const [newWorkflowInsertMode, setNewWorkflowInsertMode] = useState<'before' | 'after'>('after');
  const [newWorkflowReferenceId, setNewWorkflowReferenceId] = useState<string>('');
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());

  const [newSectorName, setNewSectorName] = useState('');
  const [newSectorParentId, setNewSectorParentId] = useState<string | null>(null);
  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  const [editingSectorName, setEditingSectorName] = useState('');
  const [isEditSectorDialogOpen, setIsEditSectorDialogOpen] = useState(false);
  
  const [newRequestTypeName, setNewRequestTypeName] = useState('');
  const [editingRequestType, setEditingRequestType] = useState<RequestType | null>(null);
  const [editingRequestTypeName, setEditingRequestTypeName] = useState('');
  const [isEditRequestTypeDialogOpen, setIsEditRequestTypeDialogOpen] = useState(false);

  const [enableNotifications, setEnableNotifications] = useState(true);
  const [overdueThreshold, setOverdueThreshold] = useState(2);
  const [isSavingAll, setIsSavingAll] = useState(false);

  const canManageWorkflows = currentUser?.permissions.includes(PERMISSIONS.MANAGE_SETTINGS_WORKFLOWS);

  const fetchInitialData = useCallback(async () => {
    if (!canManageWorkflows) {
      setIsLoadingData(false);
      return;
    }
      setIsLoadingData(true);
      setError(null);
      try {
        const [wfResult, deptResult, sectorResult, requestTypeResult] = await Promise.all([
          getWorkflowDefinitions(),
          getDepartments(),
          getSectors(),
          getRequestTypes(),
        ]);

        if (wfResult.error) throw new Error(`Workflows: ${wfResult.error}`);
        setWorkflowDefinitions((wfResult.workflows || []).sort((a,b) => (a.order || 0) - (b.order || 0)));

        if (deptResult.error) throw new Error(`Departments: ${deptResult.error}`);
        const fetchedDepts = deptResult.departments || [];
        setDepartments(fetchedDepts);

        if (sectorResult.error) throw new Error(`Sectors: ${sectorResult.error}`);
        const fetchedSectors = sectorResult.sectors || [];
        setSectors(fetchedSectors);
        
        if (requestTypeResult.error) throw new Error(`Request Types: ${requestTypeResult.error}`);
        const fetchedRequestTypes = requestTypeResult.requestTypes || [];
        setRequestTypes(fetchedRequestTypes as RequestType[]);

        if(fetchedDepts.length > 0 && newWorkflowDepartmentId === '') setNewWorkflowDepartmentId(fetchedDepts[0].id);
        const parentSectors = fetchedSectors.filter(s => !s.parentId);
        if(parentSectors.length > 0 && newWorkflowParentSectorId === '') setNewWorkflowParentSectorId(parentSectors[0].id);
        
      } catch (err: any) {
        const errorMessage = err.message || "Failed to load settings data.";
        setError(errorMessage);
        setWorkflowDefinitions([]);
        setDepartments([]);
        setSectors([]);
        setRequestTypes([]);
        toast({title: "Error Loading Settings", description: errorMessage, variant: "destructive", duration: 9000});
      } finally {
        setIsLoadingData(false);
      }
    }, [canManageWorkflows, toast]);


  useEffect(() => {
    if (!authLoading) {
      fetchInitialData();
    }
  }, [fetchInitialData, authLoading]);
  
  const parentSectors = useMemo(() => sectors.filter(s => !s.parentId), [sectors]);
  const childSectorsForSelectedParent = useMemo(() => {
    if (!newWorkflowParentSectorId) return [];
    return sectors.filter(s => s.parentId === newWorkflowParentSectorId);
  }, [sectors, newWorkflowParentSectorId]);

  useEffect(() => {
    // Reset child sector if parent changes
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


  const handleActivateWorkflowVersion = (definitionIdToActivate: string, versionIdToActivate: string) => {
    if (!canManageWorkflows) return;
    
    const targetDefToActivate = workflowDefinitions.find(d => d.id === definitionIdToActivate);
    if (!targetDefToActivate) return;
    
    setWorkflowDefinitions(prevDefs => prevDefs.map(def => {
        if (def.parentSectorId === targetDefToActivate.parentSectorId) {
            if (def.id === definitionIdToActivate) {
                return {
                    ...def,
                    versions: def.versions.map(v => ({ ...v, isActive: v.id === versionIdToActivate }))
                };
            }
            // Deactivate versions in other definitions of the same parent sector
            return {
                ...def,
                versions: def.versions.map(v => ({ ...v, isActive: false }))
            };
        }
        return def;
    }));

    const activatedVersion = targetDefToActivate?.versions.find(v => v.id === versionIdToActivate);
    toast({ title: "Success (Local)", description: `Workflow Version ${activatedVersion?.versionNumber} for '${targetDefToActivate?.name}' is now marked as active for its parent sector. Click "Save All Settings" to persist.` });
  };
  
  const handleDeactivateWorkflowVersion = (definitionId: string, versionId: string) => {
    if (!canManageWorkflows) return;
    setWorkflowDefinitions(prevDefs => prevDefs.map(def => {
        if (def.id === definitionId) {
            return {
                ...def,
                versions: def.versions.map(v => v.id === versionId ? { ...v, isActive: false } : v)
            };
        }
        return def;
    }));
    toast({ title: "Success (Local)", description: `Version deactivated locally. Click "Save All Settings" to persist.` });
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
    toast({title: "New Version Added (Local)", description: "Empty new version added. Edit to add stages. Remember to Save All Settings."});
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

  const handleAddNewWorkflowDefinition = async () => {
    if (!canManageWorkflows) return;
    if (!newWorkflowName.trim() || !newWorkflowDepartmentId || !newWorkflowParentSectorId || !newWorkflowChildSectorId) {
        toast({ title: "Validation Error", description: "Workflow name, department, parent sector, and child sector are all required.", variant: "destructive", duration: 9000 });
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
    
    const newWorkflowWithId = {
        ...newWf,
        id: `wf-def-custom-${Date.now()}`,
        versions: [],
    };
    
    if (referenceWorkflowOptions.length === 0) {
        updatedWfList.push(newWorkflowWithId);
    } else {
        const referenceIndex = updatedWfList.findIndex(wf => wf.id === newWorkflowReferenceId);
        if(referenceIndex === -1) {
            toast({ title: "Error", description: "Reference workflow not found.", variant: "destructive" });
            return;
        }
        const insertIndex = newWorkflowInsertMode === 'after' ? referenceIndex + 1 : referenceIndex;
        updatedWfList.splice(insertIndex, 0, newWorkflowWithId);
    }

    const finalList = updatedWfList.map((wf, index) => ({ ...wf, order: index }));
    
    setWorkflowDefinitions(finalList);

    setNewWorkflowName('');
    setNewWorkflowDescription('');
    
    toast({ title: "Workflow Added Locally", description: `"${newWorkflowName}" was added. Save all settings to persist.` });
  };

   const handleAddSector = async () => {
    if (!canManageWorkflows) return;
    if (!newSectorName.trim()) {
      toast({ title: "Validation Error", description: "Sector name cannot be empty.", variant: "destructive" });
      return;
    }
    setIsSavingData(true);
    try {
      const result = await addSector(newSectorName.trim(), newSectorParentId);
      if (result.error || !result.id) {
        toast({ title: "Error Adding Sector", description: result.error || "Failed to add sector.", variant: "destructive" });
      } else {
        toast({ title: "Success", description: `Sector "${newSectorName.trim()}" added.` });
        setNewSectorName('');
        await fetchInitialData(); 
      }
    } catch (error: any) {
      toast({ title: "Action Failed", description: `Error: ${error.message || "Unexpected error"}`, variant: "destructive" });
    } finally {
      setIsSavingData(false);
    }
  };

  const handleUpdateSector = async () => {
    if (!canManageWorkflows || !editingSector) return;
    if (!editingSectorName.trim()) {
        toast({ title: "Validation Error", description: "Sector name cannot be empty.", variant: "destructive" });
        return;
    }
    setIsSavingData(true);
    try {
        const result = await updateSector(editingSector.id, editingSectorName);
        if (result.error) {
            toast({ title: "Error Updating Sector", description: result.error, variant: "destructive" });
        } else {
            toast({ title: "Success", description: "Sector updated." });
            setIsEditSectorDialogOpen(false);
            setEditingSector(null);
            await fetchInitialData();
        }
    } catch (error: any) {
        toast({ title: "Action Failed", description: `Error: ${error.message || "Unexpected error"}`, variant: "destructive" });
    } finally {
        setIsSavingData(false);
    }
  };

  const handleDeleteSector = async (sectorId: string, sectorName: string) => {
    if (!canManageWorkflows) return;
    setIsSavingData(true);
    try {
      const result = await deleteSector(sectorId);
      if (result.error) {
        toast({ title: "Error Deleting Sector", description: result.error, variant: "destructive", duration: 7000 });
      } else {
        toast({ title: "Success", description: `Sector "${sectorName}" deleted.` });
        await fetchInitialData();
      }
    } catch (error: any) {
      toast({ title: "Action Failed", description: `Error: ${error.message || "Unexpected error"}`, variant: "destructive" });
    } finally {
      setIsSavingData(false);
    }
  };
  
    const handleAddRequestType = async () => {
    if (!canManageWorkflows) return;
    if (!newRequestTypeName.trim()) {
      toast({ title: "Validation Error", description: "Request Type name cannot be empty.", variant: "destructive" });
      return;
    }
    setIsSavingData(true);
    try {
      const result = await addRequestType(newRequestTypeName.trim());
      if (result.error || !result.id) {
        toast({ title: "Error Adding Request Type", description: result.error || "Failed to add request type.", variant: "destructive" });
      } else {
        toast({ title: "Success", description: `Request Type "${newRequestTypeName.trim()}" added.` });
        setNewRequestTypeName('');
        await fetchInitialData(); 
      }
    } catch (error: any) {
      toast({ title: "Action Failed", description: `Error: ${error.message || "Unexpected error"}`, variant: "destructive" });
    } finally {
      setIsSavingData(false);
    }
  };

  const handleUpdateRequestType = async () => {
    if (!canManageWorkflows || !editingRequestType) return;
    if (!editingRequestTypeName.trim()) {
        toast({ title: "Validation Error", description: "Request Type name cannot be empty.", variant: "destructive" });
        return;
    }
    setIsSavingData(true);
    try {
        const result = await updateRequestType(editingRequestType.id, editingRequestTypeName);
        if (result.error) {
            toast({ title: "Error Updating Request Type", description: result.error, variant: "destructive" });
        } else {
            toast({ title: "Success", description: "Request Type updated." });
            setIsEditRequestTypeDialogOpen(false);
            setEditingRequestType(null);
            await fetchInitialData();
        }
    } catch (error: any) {
        toast({ title: "Action Failed", description: `Error: ${error.message || "Unexpected error"}`, variant: "destructive" });
    } finally {
        setIsSavingData(false);
    }
  };

  const handleDeleteRequestType = async (requestTypeId: string, requestTypeName: string) => {
    if (!canManageWorkflows) return;
    setIsSavingData(true);
    try {
      const result = await deleteRequestType(requestTypeId);
      if (result.error) {
        toast({ title: "Error Deleting Request Type", description: result.error, variant: "destructive", duration: 7000 });
      } else {
        toast({ title: "Success", description: `Request Type "${requestTypeName}" deleted.` });
        await fetchInitialData();
      }
    } catch (error: any) {
      toast({ title: "Action Failed", description: `Error: ${error.message || "Unexpected error"}`, variant: "destructive" });
    } finally {
      setIsSavingData(false);
    }
  };


  const handleSaveChanges = async () => {
    if (!canManageWorkflows && !currentUser?.permissions.includes(PERMISSIONS.MANAGE_SETTINGS_DEPARTMENTS) && !currentUser?.permissions.includes(PERMISSIONS.MANAGE_SETTINGS_ROLES)) {
         toast({ title: "Permission Denied", description: "You do not have permission to save settings.", variant: "destructive" });
        return;
    }
    setIsSavingAll(true);
    setError(null);
    try {
        if (canManageWorkflows) {
            const result = await saveWorkflowDefinitions(workflowDefinitions);
            if (result.error) {
                throw new Error(result.error);
            }
        }
        toast({ title: "Settings Saved to Database", description: "Configurations have been persisted.", action: <Check className="h-5 w-5 text-green-500" /> });
        await fetchInitialData();
    } catch (err: any) {
        toast({ title: "Saving Failed", description: `Error: ${err.message || "Unknown error"}`, variant: "destructive", duration: 9000 });
    } finally {
        setIsSavingAll(false);
    }
  };

  const toggleDescription = (id: string) => {
    setExpandedDescriptions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  if (authLoading || isLoadingData) {
    return (
        <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="ml-3 text-lg">Loading settings...</p>
        </div>
    );
  }

  const canAccessAnySettings = currentUser?.permissions.some(p => 
    p === PERMISSIONS.MANAGE_SETTINGS_WORKFLOWS ||
    p === PERMISSIONS.MANAGE_SETTINGS_DEPARTMENTS ||
    p === PERMISSIONS.MANAGE_SETTINGS_ROLES ||
    p === PERMISSIONS.MANAGE_USERS
  );

  if (!currentUser || !canAccessAnySettings) {
    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-10rem)] text-center p-4">
            <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
            <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
            <p className="text-muted-foreground mb-6">You do not have permission to view the settings page.</p>
            <Link href="/" passHref>
                <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4"/>Go to Dashboard</Button>
            </Link>
        </div>
    );
  }
  
  if (error) {
     return (
        <div className="space-y-6 p-4 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
            <h2 className="text-2xl font-semibold text-destructive">Failed to Load Settings Data</h2>
            <p className="text-muted-foreground">{error}</p>
            <p className="text-sm text-muted-foreground mt-2">Please ensure your database is configured and reachable. Check console for details.</p>
            <Button onClick={() => window.location.reload()}>Try Reloading</Button>
        </div>
    );
  }
  
  const workflowsByCombination = workflowDefinitions.reduce((acc, wf) => {
    const key = `${wf.parentSectorName}`;
    if (!acc[key]) {
      acc[key] = {
        parentSectorName: wf.parentSectorName,
        workflows: []
      };
    }
    acc[key].workflows.push(wf);
    acc[key].workflows.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return acc;
  }, {} as Record<string, { parentSectorName?: string; workflows: WorkflowDefinition[] }>);


  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure various aspects of the LoanFlow application. Access to specific sections depends on your permissions.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
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
        </div>
      </div>

    {canManageWorkflows && (
      <>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
            <CardHeader>
                <CardTitle>Manage Sectors (Parent & Child)</CardTitle>
                <CardDescription>Define business sectors, e.g., "Agriculture", and sub-sectors, e.g., "Crop", "Livestock".</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                    <Input
                        placeholder="e.g., Service Industry, Crop Production"
                        value={newSectorName}
                        onChange={(e) => setNewSectorName(e.target.value)}
                        disabled={isSavingData || isSavingAll}
                    />
                    <Select value={newSectorParentId || 'none'} onValueChange={(value) => setNewSectorParentId(value === 'none' ? null : value)}>
                        <SelectTrigger className="w-full sm:w-[200px]">
                            <SelectValue placeholder="Select Parent (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">None (Is a Parent)</SelectItem>
                            {parentSectors.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Button onClick={handleAddSector} disabled={!newSectorName.trim() || isSavingData || isSavingAll} className="w-full sm:w-auto">
                        {isSavingData ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4" />}
                        Add Sector
                    </Button>
                </div>
                <Table>
                  <TableHeader><TableRow><TableHead>Sector Name</TableHead><TableHead>Parent</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {sectors.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No sectors defined yet.</TableCell></TableRow>}
                    {sectors.filter(s => !s.parentId).map(parent => (
                        <React.Fragment key={parent.id}>
                            <TableRow className="bg-muted/30">
                                <TableCell className="font-semibold">{parent.name}</TableCell>
                                <TableCell className="text-muted-foreground">-</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="sm" onClick={() => { setEditingSector(parent); setEditingSectorName(parent.name); setIsEditSectorDialogOpen(true); }} disabled={isSavingData || isSavingAll}><Edit className="mr-1 h-4 w-4" /></Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" disabled={isSavingData || isSavingAll}><Trash2 className="mr-1 h-4 w-4" /></Button></AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader><AlertDialogTitle>Delete Sector "{parent.name}"?</AlertDialogTitle><AlertDialogDescription>This may affect workflow definitions or child sectors that use it.</AlertDialogDescription></AlertDialogHeader>
                                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteSector(parent.id, parent.name)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Confirm Delete</AlertDialogAction></AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </TableCell>
                            </TableRow>
                            {sectors.filter(s => s.parentId === parent.id).map(child => (
                                <TableRow key={child.id}>
                                    <TableCell className="pl-8">{child.name}</TableCell>
                                    <TableCell className="text-muted-foreground">{parent.name}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" onClick={() => { setEditingSector(child); setEditingSectorName(child.name); setIsEditSectorDialogOpen(true); }} disabled={isSavingData || isSavingAll}><Edit className="mr-1 h-4 w-4" /></Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" disabled={isSavingData || isSavingAll}><Trash2 className="mr-1 h-4 w-4" /></Button></AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader><AlertDialogTitle>Delete Sector "{child.name}"?</AlertDialogTitle><AlertDialogDescription>This may affect workflow definitions that use it.</AlertDialogDescription></AlertDialogHeader>
                                                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteSector(child.id, child.name)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Confirm Delete</AlertDialogAction></AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle>Manage Request Types</CardTitle>
                <CardDescription>Define request types, e.g., "New Loan", "Restructuring".</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                    <Input
                        placeholder="e.g., Additional Facility"
                        value={newRequestTypeName}
                        onChange={(e) => setNewRequestTypeName(e.target.value)}
                        disabled={isSavingData || isSavingAll}
                    />
                    <Button onClick={handleAddRequestType} disabled={!newRequestTypeName.trim() || isSavingData || isSavingAll} className="w-full sm:w-auto">
                        {isSavingData ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4" />}
                        Add Request Type
                    </Button>
                </div>
                <Table>
                  <TableHeader><TableRow><TableHead>Request Type Name</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {requestTypes.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No request types defined yet.</TableCell></TableRow>}
                    {requestTypes.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => { setEditingRequestType(item); setEditingRequestTypeName(item.name); setIsEditRequestTypeDialogOpen(true); }} disabled={isSavingData || isSavingAll}>
                              <Edit className="mr-1 h-4 w-4" />
                            </Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" disabled={isSavingData || isSavingAll}><Trash2 className="mr-1 h-4 w-4" /></Button></AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Delete Request Type "{item.name}"?</AlertDialogTitle><AlertDialogDescription>This may affect existing loan requests that use it.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteRequestType(item.id, item.name)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Confirm Delete</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
            </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workflow Definitions</CardTitle>
          <CardDescription>Manage workflows. New loans use the active version for their specific Parent Sector.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
            <h4 className="font-medium text-lg">Add New Workflow Definition</h4>
            <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-4">
              <div><Label htmlFor="new-wf-name">Workflow Name</Label><Input id="new-wf-name" value={newWorkflowName} onChange={e => setNewWorkflowName(e.target.value)} placeholder="e.g., SME Credit Line" disabled={isSavingAll || isSavingData} /></div>
              <div>
                <Label htmlFor="new-wf-dept">Owning Department</Label>
                <Select value={newWorkflowDepartmentId} onValueChange={(value) => setNewWorkflowDepartmentId(value)}>
                  <SelectTrigger id="new-wf-dept" className="mt-1"><SelectValue placeholder="Select Department" /></SelectTrigger>
                  <SelectContent>{departments.map(d => <SelectItem key={`new-wf-dept-option-${d.id}`} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="new-wf-parent-sector">For Parent Sector</Label>
                <Select value={newWorkflowParentSectorId} onValueChange={(value) => setNewWorkflowParentSectorId(value)}>
                  <SelectTrigger id="new-wf-parent-sector" className="mt-1"><SelectValue placeholder="Select Parent Sector" /></SelectTrigger>
                  <SelectContent>{parentSectors.map(s => <SelectItem key={`new-wf-ps-option-${s.id}`} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
               <div>
                <Label htmlFor="new-wf-child-sector">For Child Sector</Label>
                <Select value={newWorkflowChildSectorId} onValueChange={(value) => setNewWorkflowChildSectorId(value)} disabled={!newWorkflowParentSectorId}>
                  <SelectTrigger id="new-wf-child-sector" className="mt-1"><SelectValue placeholder="Select Child Sector" /></SelectTrigger>
                  <SelectContent>
                    {childSectorsForSelectedParent.length === 0 && <SelectItem value="none" disabled>No child sectors</SelectItem>}
                    {childSectorsForSelectedParent.map(s => <SelectItem key={`new-wf-cs-option-${s.id}`} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2"><Label htmlFor="new-wf-desc">Description</Label><Textarea id="new-wf-desc" value={newWorkflowDescription} onChange={e => setNewWorkflowDescription(e.target.value)} placeholder="Brief description of this workflow definition" disabled={isSavingAll || isSavingData} /></div>
            </div>
            
            <div className="grid md:grid-cols-3 gap-4 items-end">
              <div className="flex items-center space-x-2">
                <Label>Insert</Label>
                <Select value={newWorkflowInsertMode} onValueChange={(v) => setNewWorkflowInsertMode(v as 'before' | 'after')}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="before">Before</SelectItem>
                    <SelectItem value="after">After</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Reference Workflow (in same category)</Label>
                <Select value={newWorkflowReferenceId} onValueChange={setNewWorkflowReferenceId} disabled={referenceWorkflowOptions.length === 0}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select reference workflow"/></SelectTrigger>
                  <SelectContent>
                    {referenceWorkflowOptions.length === 0 ? (
                      <SelectItem value="no-workflows-found" disabled>No existing workflows for this category</SelectItem>
                    ) : (
                      referenceWorkflowOptions.map(wf => <SelectItem key={wf.id} value={wf.id}>{wf.order + 1}. {wf.name}</SelectItem>)
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddNewWorkflowDefinition} disabled={isSavingAll || isSavingData}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Workflow
              </Button>
            </div>
            {(parentSectors.length === 0 || departments.length === 0) && <p className="text-xs text-destructive mt-1">Cannot add workflow: A parent sector and department must be configured first.</p>}
          </div>

          <Separator/>
          
          <h4 className="font-medium text-lg">Current Workflow Paths (By Parent Sector)</h4>
          <div className="space-y-4">
          {Object.values(workflowsByCombination).map(({ parentSectorName, workflows }) => (
            <div key={`${parentSectorName}`} className="p-4 border rounded-lg">
              <h5 className="font-medium mb-3"><span className="text-primary">{parentSectorName}</span> Path</h5>
              <div className="flex items-center space-x-4 min-w-max overflow-x-auto pb-2">
                {workflows.map((def, index) => (
                  <React.Fragment key={def.id}>
                    <div className="flex flex-col items-center text-center w-36">
                      <div className="h-10 w-10 flex items-center justify-center bg-primary text-primary-foreground rounded-full font-bold text-lg shrink-0">
                        {index + 1}
                      </div>
                      <div className="mt-2 text-sm font-semibold max-w-[150px] break-words">{def.name}</div>
                       <div className="text-xs text-muted-foreground flex items-center gap-1"><Network className="h-3 w-3" />{def.sectorName}</div>
                      <div className="text-xs text-muted-foreground">{def.departmentName}</div>
                    </div>
                    {index < workflows.length - 1 && <ArrowRight className="h-6 w-6 text-muted-foreground shrink-0" />}
                  </React.Fragment>
                ))}
                {workflows.length === 0 && <p className="text-muted-foreground">No workflows defined for this combination.</p>}
              </div>
            </div>
          ))}
          {Object.keys(workflowsByCombination).length === 0 && (
             <div className="p-4 border rounded-lg text-center text-muted-foreground">No workflows defined yet. Add one above to start.</div>
          )}
        </div>
            
          <Accordion type="multiple" className="w-full space-y-4">
          {workflowDefinitions.map(def => (
            <AccordionItem value={def.id} key={def.id}>
              <Card className="shadow-sm">
                <AccordionTrigger className="hover:no-underline p-0">
                  <CardHeader className="flex flex-row justify-between items-center w-full p-4 hover:bg-muted/30 rounded-t-lg transition-colors">
                    <div className="text-left">
                      <CardTitle className="text-xl">{def.order + 1}. {def.name}</CardTitle>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge variant="outline">Dept: {def.departmentName || 'N/A'}</Badge>
                        <Badge variant="outline">Parent Sector: {def.parentSectorName || 'N/A'}</Badge>
                        <Badge variant="secondary">Child Sector: {def.sectorName || 'N/A'}</Badge>
                        {def.description && (
                          <Button variant="ghost" size="sm" className="h-auto p-1 text-xs" onClick={(e) => { e.stopPropagation(); toggleDescription(def.id); }}>
                            {expandedDescriptions.has(def.id) ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                            {expandedDescriptions.has(def.id) ? 'Hide' : 'Show'} Desc.
                          </Button>
                        )}
                      </div>
                      {expandedDescriptions.has(def.id) && (
                        <CardDescription className="mt-2 text-sm text-muted-foreground animate-in fade-in-0">
                          {def.description || "No description."}
                        </CardDescription>
                      )}
                    </div>
                  </CardHeader>
                </AccordionTrigger>
                <AccordionContent className="p-0">
                  <CardContent className="space-y-3 p-4">
                    <h4 className="font-medium text-sm">Versions (Latest first):</h4>
                    {def.versions.length === 0 && <p className="text-sm text-muted-foreground">No versions defined for this workflow. Add one below.</p>}
                    {def.versions.sort((a,b) => b.versionNumber - a.versionNumber).map(version => (
                      <div key={version.id} className={`flex flex-col sm:flex-row justify-between sm:items-center p-3 border rounded-md gap-2 ${version.isActive ? "border-primary bg-primary/5" : "bg-muted/30"}`}>
                        <div>
                          <div className="font-semibold flex items-center">
                            Version {version.versionNumber}
                            {version.isActive && <Badge className="ml-2 bg-green-600 text-white">Active</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">Created: {version.createdAt ? new Date(version.createdAt).toLocaleDateString() : 'N/A'} | Stages: {version.stages.length}</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                            {!version.isActive ? (
                                <Button variant="outline" size="sm" onClick={() => handleActivateWorkflowVersion(def.id, version.id)} disabled={isSavingAll || isSavingData}>
                                    <ShieldCheck className="mr-2 h-4 w-4"/>Set Active
                                </Button>
                            ) : (
                                <Button variant="secondary" size="sm" onClick={() => handleDeactivateWorkflowVersion(def.id, version.id)} disabled={isSavingAll || isSavingData} className="text-amber-700 border-amber-500 hover:bg-amber-100">
                                    <ShieldOff className="mr-2 h-4 w-4"/>Deactivate
                                </Button>
                            )}
                            <Button variant="outline" size="sm" onClick={() => handleOpenEditVersionDialog(def, version)} disabled={isSavingAll || isSavingData}>
                                <Edit className="mr-2 h-4 w-4" />Edit Stages
                            </Button>
                        </div>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => handleAddNewVersion(def.id)} className="mt-2" disabled={isSavingAll || isSavingData}><PlusCircle className="mr-2 h-4 w-4" />Add New Version to &quot;{def.name}&quot;</Button>
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>
          ))}
          </Accordion>
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
        onSaveVersion={handleSaveVersion}
        departmentName={currentWorkflowDefForEdit?.departmentName || ''}
      />
      
      <Dialog open={isEditSectorDialogOpen} onOpenChange={setIsEditSectorDialogOpen}>
        <DialogContent>
            <DialogHeader><DialogTitle>Edit Sector</DialogTitle><DialogDescription>Update the name for &quot;{editingSector?.name}&quot;.</DialogDescription></DialogHeader>
            <div className="grid gap-4 py-4">
                <Label htmlFor="editing-sector-name">New Name</Label>
                <Input id="editing-sector-name" value={editingSectorName} onChange={(e) => setEditingSectorName(e.target.value)} disabled={isSavingData} />
            </div>
            <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline" disabled={isSavingData}>Cancel</Button></DialogClose>
                <Button type="button" onClick={handleUpdateSector} disabled={isSavingData || !editingSectorName.trim()}>
                    {isSavingData ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isEditRequestTypeDialogOpen} onOpenChange={setIsEditRequestTypeDialogOpen}>
        <DialogContent>
            <DialogHeader><DialogTitle>Edit Request Type</DialogTitle><DialogDescription>Update the name for &quot;{editingRequestType?.name}&quot;.</DialogDescription></DialogHeader>
            <div className="grid gap-4 py-4">
                <Label htmlFor="editing-rt-name">New Name</Label>
                <Input id="editing-rt-name" value={editingRequestTypeName} onChange={(e) => setEditingRequestTypeName(e.target.value)} disabled={isSavingData} />
            </div>
            <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline" disabled={isSavingData}>Cancel</Button></DialogClose>
                <Button type="button" onClick={handleUpdateRequestType} disabled={isSavingData || !editingRequestTypeName.trim()}>
                    {isSavingData ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>


      <Card>
        <CardHeader><CardTitle>Notification Settings (Conceptual)</CardTitle><CardDescription>Manage how and when notifications are sent for overdue tasks. (Currently UI only).</CardDescription></CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div><Label htmlFor="enable-notifications" className="font-medium">Enable Overdue Notifications</Label><p className="text-sm text-muted-foreground">Receive alerts for loan processes exceeding their timeline.</p></div>
            <Switch id="enable-notifications" checked={enableNotifications} onCheckedChange={setEnableNotifications} disabled={isSavingAll || isSavingData}/>
          </div>
          {enableNotifications && (
            <div className="space-y-2 p-4 border rounded-lg bg-muted/20">
              <Label htmlFor="overdue-threshold">Notify if overdue by (days)</Label>
              <div className="flex items-center gap-2"><Clock className="h-5 w-5 text-muted-foreground" /><Input id="overdue-threshold" type="number" value={overdueThreshold} onChange={(e) => setOverdueThreshold(parseInt(e.target.value,10))} className="max-w-xs" min="1" disabled={isSavingAll || isSavingData}/></div>
              <p className="text-xs text-muted-foreground">Notifications will be triggered if a loan stage is {overdueThreshold} or more days past its deadline.</p>
            </div>
          )}
          <div className="p-4 border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/30 rounded-r-md">
             <div className="flex items-start"><AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-3 mt-0.5 flex-shrink-0" /><div><h5 className="font-semibold text-yellow-700 dark:text-yellow-300">System Note</h5><p className="text-sm text-yellow-600 dark:text-yellow-400">Actual notification delivery needs backend integration. This configures triggers.</p></div></div>
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end"><Button onClick={handleSaveChanges} size="lg" disabled={isSavingAll || isSavingData}>
        {(isSavingAll || isSavingData) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isSavingAll ? "Saving..." : "Save All Settings to Database"}
        </Button></div>
    </div>
  );
}

