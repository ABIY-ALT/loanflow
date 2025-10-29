

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Check, PlusCircle, Trash2, AlertTriangle, Save, Clock, GripVertical, FileText, Users, Percent, Copy, Eye, Edit, History, Type as TypeIcon, ShieldCheck, ShieldOff, Loader2, ShieldAlert, ArrowLeft, ArrowRight } from 'lucide-react';
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
import type { WorkflowDefinition, WorkflowVersion, WorkflowStageDefinition, Department, DocumentRequirement } from '@/types/loan';
import { DocumentRequirementType } from '@/types/loan';
import { PERMISSIONS } from '@/lib/permissions'; // Import PERMISSIONS
import { getWorkflowDefinitions, saveWorkflowDefinitions, getDepartments, addWorkflowDefinition } from '@/services/loan-service-prisma';
import { getLoanTypes, addLoanType, deleteLoanType as deleteLoanTypeService } from '@/services/loan-type-service';
import type { LoanType } from '@/types/loan';
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

const createNewDocumentRequirement = (name: string): DocumentRequirement => ({
  id: `doc-req-custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
  name,
  isMandatory: true,
  type: DocumentRequirementType.UPLOAD,
});


interface DepartmentObject {
  id: string;
  name: Department;
}
interface LoanTypeObject {
  id: string;
  name: string;
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
}

function EditWorkflowVersionDialog({
  isOpen, onOpenChange, workflowDefinition, versionToEdit, onSaveVersion,
}: EditWorkflowVersionDialogProps) {
  const [editedVersion, setEditedVersion] = useState<WorkflowVersion | null>(null);
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const { toast } = useToast();

  const [newStageName, setNewStageName] = useState('');
  const [newStageTimeline, setNewStageTimeline] = useState(3);
  const [newStageWeight, setNewStageWeight] = useState(10);

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
  
  const handleInternalAddStageToVersion = (departmentName: string) => {
    if (!editedVersion || !workflowDefinition) return;
    if(!newStageName.trim()){
        toast({ title: "Error", description: "New stage name is required.", variant: "destructive"});
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
    const newDocReq = createNewDocumentRequirement(docName);
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
            <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                <h5 className="font-medium">Add New Stage to this Version</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                    <div className="sm:col-span-2"><Label htmlFor="new-s-name">Stage Name</Label><Input id="new-s-name" value={newStageName} onChange={e=>setNewStageName(e.target.value)} placeholder="New Stage Name" /></div>
                    <div><Label htmlFor="new-s-time">Timeline (days)</Label><Input id="new-s-time" type="number" value={newStageTimeline} onChange={e=>setNewStageTimeline(parseInt(e.target.value,10)||0)} min="0"/></div>
                    <div><Label htmlFor="new-s-weight">Weight (%)</Label><Input id="new-s-weight" type="number" value={newStageWeight} onChange={e=>setNewStageWeight(parseInt(e.target.value,10)||0)} min="0" max="100"/></div>
                    <Button onClick={() => handleInternalAddStageToVersion(workflowDefinition.departmentName)} size="sm" className="sm:col-span-2"><PlusCircle className="mr-2 h-4 w-4"/>Add Stage to Version</Button>
                </div>
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
  const [loanTypes, setLoanTypes] = useState<LoanTypeObject[]>([]);
  
  const [error, setError] = useState<string | null>(null);

  const [isEditVersionDialogOpen, setIsEditVersionDialogOpen] = useState(false);
  const [currentWorkflowDefForEdit, setCurrentWorkflowDefForEdit] = useState<WorkflowDefinition | null>(null);
  const [currentVersionToEdit, setCurrentVersionToEdit] = useState<WorkflowVersion | null>(null);

  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [newWorkflowDepartmentId, setNewWorkflowDepartmentId] = useState('');
  const [newWorkflowLoanTypeId, setNewWorkflowLoanTypeId] = useState('');
  const [newWorkflowDescription, setNewWorkflowDescription] = useState('');
  
  const [newWorkflowInsertMode, setNewWorkflowInsertMode] = useState<'before' | 'after'>('after');
  const [newWorkflowReferenceId, setNewWorkflowReferenceId] = useState<string>('');


  const [newLoanTypeName, setNewLoanTypeName] = useState('');

  const [enableNotifications, setEnableNotifications] = useState(true);
  const [overdueThreshold, setOverdueThreshold] = useState(2);
  const [isSavingAll, setIsSavingAll] = useState(false);

  const canManageWorkflows = currentUser?.permissions.includes(PERMISSIONS.MANAGE_SETTINGS_WORKFLOWS);

  const fetchInitialData = useCallback(async () => {
      setIsLoadingData(true);
      setError(null);
      try {
        const [wfResult, deptResult, loanTypeResult] = await Promise.all([
          getWorkflowDefinitions(),
          getDepartments(),
          getLoanTypes(),
        ]);

        if (wfResult.error) throw new Error(`Workflows: ${wfResult.error}`);
        setWorkflowDefinitions((wfResult.workflows || []).sort((a,b) => (a.order || 0) - (b.order || 0)));

        if (deptResult.error) throw new Error(`Departments: ${deptResult.error}`);
        const fetchedDepts = deptResult.departments || [];
        setDepartments(fetchedDepts);

        if (loanTypeResult.error) throw new Error(`Loan Types: ${loanTypeResult.error}`);
        const fetchedLoanTypes = loanTypeResult.loanTypes || [];
        setLoanTypes(fetchedLoanTypes);

        if(fetchedDepts.length > 0 && newWorkflowDepartmentId === '') setNewWorkflowDepartmentId(fetchedDepts[0].id);
        if(fetchedLoanTypes.length > 0 && newWorkflowLoanTypeId === '') setNewWorkflowLoanTypeId(fetchedLoanTypes[0].id);
        
        if (wfResult.workflows && wfResult.workflows.length > 0) {
            const sortedWfs = wfResult.workflows.sort((a,b) => (a.order || 0) - (b.order || 0));
            setNewWorkflowReferenceId(sortedWfs[sortedWfs.length - 1].id);
        }

      } catch (err: any) {
        const errorMessage = err.message || "Failed to load settings data.";
        setError(errorMessage);
        setWorkflowDefinitions([]);
        setDepartments([]);
        setLoanTypes([]);
        toast({title: "Error Loading Settings", description: errorMessage, variant: "destructive", duration: 9000});
      } finally {
        setIsLoadingData(false);
      }
    }, [toast]);


  useEffect(() => {
    if (currentUser && (currentUser.permissions.includes(PERMISSIONS.MANAGE_SETTINGS_WORKFLOWS) || 
                        currentUser.permissions.includes(PERMISSIONS.MANAGE_SETTINGS_DEPARTMENTS) ||
                        currentUser.permissions.includes(PERMISSIONS.MANAGE_SETTINGS_ROLES) ||
                        currentUser.permissions.includes(PERMISSIONS.MANAGE_USERS)
                        )) {
        fetchInitialData();
    }
  }, [fetchInitialData, currentUser]);


  const handleActivateWorkflowVersion = (definitionIdToActivate: string, versionIdToActivate: string) => {
    if (!canManageWorkflows) return;
    
    const targetDefToActivate = workflowDefinitions.find(d => d.id === definitionIdToActivate);
    if (!targetDefToActivate) return;
    
    setWorkflowDefinitions(prevDefs => prevDefs.map(def => {
        if (def.departmentId === targetDefToActivate.departmentId && def.loanTypeId === targetDefToActivate.loanTypeId) {
            if (def.id === definitionIdToActivate) {
                return {
                    ...def,
                    versions: def.versions.map(v => ({ ...v, isActive: v.id === versionIdToActivate }))
                };
            }
            return {
                ...def,
                versions: def.versions.map(v => ({ ...v, isActive: false }))
            };
        }
        return def;
    }));

    const activatedVersion = targetDefToActivate?.versions.find(v => v.id === versionIdToActivate);
    toast({ title: "Success (Local)", description: `Workflow Version ${activatedVersion?.versionNumber} for '${targetDefToActivate?.name}' is now marked as active for its Department/Loan Type. Click "Save All Settings" to persist.` });
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
    if (!newWorkflowName.trim() || !newWorkflowDepartmentId || !newWorkflowLoanTypeId) {
        toast({ title: "Validation Error", description: "Workflow name, department, and loan type are all required.", variant: "destructive", duration: 9000 });
        return;
    }
    
    if (workflowDefinitions.length > 0 && !newWorkflowReferenceId) {
      toast({ title: "Validation Error", description: "A reference workflow must be selected to determine the order.", variant: "destructive", duration: 9000 });
      return;
    }

    const newWf: Omit<WorkflowDefinition, 'id' | 'versions'> = {
        name: newWorkflowName,
        description: newWorkflowDescription,
        departmentId: newWorkflowDepartmentId,
        departmentName: departments.find(d => d.id === newWorkflowDepartmentId)?.name || 'Unknown',
        loanTypeId: newWorkflowLoanTypeId,
        loanTypeName: loanTypes.find(lt => lt.id === newWorkflowLoanTypeId)?.name || 'Unknown',
        order: 0,
    };
    
    let updatedWfList = [...workflowDefinitions];
    
    const newWorkflowWithId = {
        ...newWf,
        id: `wf-def-custom-${Date.now()}`,
        versions: [],
    };
    
    if (updatedWfList.length === 0) {
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

    // Re-assign order to all items
    const finalList = updatedWfList.map((wf, index) => ({ ...wf, order: index }));
    
    setWorkflowDefinitions(finalList);

    // Reset form
    setNewWorkflowName('');
    setNewWorkflowDescription('');
    
    toast({ title: "Workflow Added Locally", description: `"${newWorkflowName}" was added. Save all settings to persist.` });
  };

   const handleAddLoanType = async () => {
    if (!canManageWorkflows) return;
    if (!newLoanTypeName.trim()) {
      toast({ title: "Validation Error", description: "Loan type name cannot be empty.", variant: "destructive" });
      return;
    }
    setIsSavingData(true);
    try {
      const result = await addLoanType(newLoanTypeName.trim());
      if (result.error || !result.id) {
        toast({ title: "Error Adding Loan Type", description: result.error || "Failed to add loan type.", variant: "destructive" });
      } else {
        toast({ title: "Success", description: `Loan type "${newLoanTypeName.trim()}" added.` });
        setNewLoanTypeName('');
        await fetchInitialData(); 
      }
    } catch (error: any) {
      toast({ title: "Action Failed", description: `Error: ${error.message || "Unexpected error"}`, variant: "destructive" });
    } finally {
      setIsSavingData(false);
    }
  };

  const handleDeleteLoanType = async (loanTypeId: string, loanTypeName: string) => {
    if (!canManageWorkflows) return;
    setIsSavingData(true);
    try {
      const result = await deleteLoanTypeService(loanTypeId);
      if (result.error) {
        toast({ title: "Error Deleting Loan Type", description: result.error, variant: "destructive", duration: 7000 });
      } else {
        toast({ title: "Success", description: `Loan type "${loanTypeName}" deleted.` });
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

  const sortedWorkflowDefinitions = workflowDefinitions.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

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
      <Card>
          <CardHeader>
              <CardTitle>Manage Loan Types</CardTitle>
              <CardDescription>Define the types of loans your organization processes, e.g., "Personal Loan", "Mortgage".</CardDescription>
          </CardHeader>
          <CardContent>
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                  <Input
                      placeholder="e.g., Small Business Loan"
                      value={newLoanTypeName}
                      onChange={(e) => setNewLoanTypeName(e.target.value)}
                      disabled={isSavingData || isSavingAll}
                  />
                  <Button onClick={handleAddLoanType} disabled={!newLoanTypeName.trim() || isSavingData || isSavingAll} className="w-full sm:w-auto">
                      {isSavingData ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4" />}
                      Add Loan Type
                  </Button>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>Loan Type Name</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {loanTypes.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No loan types defined yet.</TableCell></TableRow>}
                  {loanTypes.map(lt => (
                    <TableRow key={lt.id}>
                      <TableCell className="font-medium">{lt.name}</TableCell>
                      <TableCell className="text-right">
                          <AlertDialog>
                              <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" disabled={isSavingData || isSavingAll}>
                                      <Trash2 className="mr-1 h-4 w-4" /> Delete
                                  </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                  <AlertDialogHeader>
                                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                      <AlertDialogDescription>This action cannot be undone. This will delete the loan type "{lt.name}" and may affect workflow definitions that use it.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDeleteLoanType(lt.id, lt.name)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Confirm Delete</AlertDialogAction>
                                  </AlertDialogFooter>
                              </AlertDialogContent>
                          </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Workflow Definitions</CardTitle>
          <CardDescription>Manage workflows for different departments and loan types. New loans will use the active version for their specific department and loan type combination.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
            <h4 className="font-medium text-lg">Add New Workflow Definition</h4>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div><Label htmlFor="new-wf-name">Workflow Name</Label><Input id="new-wf-name" value={newWorkflowName} onChange={e => setNewWorkflowName(e.target.value)} placeholder="e.g., Standard Personal Loan Process" disabled={isSavingAll || isSavingData} /></div>
              <div>
                <Label htmlFor="new-wf-loantype">For Loan Type</Label>
                <Select value={newWorkflowLoanTypeId} onValueChange={(value) => setNewWorkflowLoanTypeId(value)}>
                  <SelectTrigger id="new-wf-loantype" className="mt-1"><SelectValue placeholder="Select Loan Type" /></SelectTrigger>
                  <SelectContent>
                    {loanTypes.map(lt => <SelectItem key={`new-wf-lt-option-${lt.id}`} value={lt.id}>{lt.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="new-wf-dept">For Department</Label>
                <Select value={newWorkflowDepartmentId} onValueChange={(value) => setNewWorkflowDepartmentId(value)}>
                  <SelectTrigger id="new-wf-dept" className="mt-1"><SelectValue placeholder="Select Department" /></SelectTrigger>
                  <SelectContent>
                    {departments.map(d => <SelectItem key={`new-wf-dept-option-${d.id}`} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-3"><Label htmlFor="new-wf-desc">Description</Label><Textarea id="new-wf-desc" value={newWorkflowDescription} onChange={e => setNewWorkflowDescription(e.target.value)} placeholder="Brief description of this workflow definition" disabled={isSavingAll || isSavingData} /></div>
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
                <Label>Reference Workflow</Label>
                <Select value={newWorkflowReferenceId} onValueChange={setNewWorkflowReferenceId} disabled={sortedWorkflowDefinitions.length === 0}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select reference workflow"/></SelectTrigger>
                  <SelectContent>
                    {sortedWorkflowDefinitions.length === 0 && <SelectItem value="no-workflows" disabled>No existing workflows</SelectItem>}
                    {sortedWorkflowDefinitions.map(wf => <SelectItem key={wf.id} value={wf.id}>{wf.order + 1}. {wf.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddNewWorkflowDefinition} disabled={isSavingAll || isSavingData}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Workflow
              </Button>
            </div>
            {(loanTypes.length === 0 || departments.length === 0) && <p className="text-xs text-destructive mt-1">Cannot add workflow: Both a department and a loan type must be configured first.</p>}
          </div>

          <Separator/>
          
          <h4 className="font-medium text-lg">Current Workflow Order</h4>
          <div className="p-4 border rounded-lg overflow-x-auto">
            <div className="flex items-center space-x-4 min-w-max">
                {sortedWorkflowDefinitions.map((def, index) => (
                    <React.Fragment key={def.id}>
                        <div className="flex flex-col items-center text-center">
                            <div className="h-10 w-10 flex items-center justify-center bg-primary text-primary-foreground rounded-full font-bold text-lg">
                                {def.order + 1}
                            </div>
                            <div className="mt-2 text-sm font-semibold max-w-[150px] break-words">{def.name}</div>
                            <div className="text-xs text-muted-foreground">{def.loanTypeName} / {def.departmentName}</div>
                        </div>
                        {index < sortedWorkflowDefinitions.length - 1 && <ArrowRight className="h-6 w-6 text-muted-foreground shrink-0"/>}
                    </React.Fragment>
                ))}
                {sortedWorkflowDefinitions.length === 0 && <p className="text-muted-foreground">No workflows defined yet. Add one above to start.</p>}
            </div>
          </div>
            
          <Accordion type="multiple" className="w-full space-y-4">
          {sortedWorkflowDefinitions.map(def => (
            <AccordionItem value={def.id} key={def.id}>
              <Card className="shadow-sm">
                <AccordionTrigger className="hover:no-underline p-0">
                  <CardHeader className="flex flex-row justify-between items-center w-full p-4 hover:bg-muted/30 rounded-t-lg transition-colors">
                    <div>
                      <CardTitle className="text-xl">{def.order + 1}. {def.name}</CardTitle>
                      <CardDescription>{def.description || "No description."} <Badge variant="outline" className="ml-2">Dept: {def.departmentName || 'N/A'}</Badge><Badge variant="outline" className="ml-2">Loan Type: {def.loanTypeName || 'N/A'}</Badge></CardDescription>
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
                            {!version.isActive &&
                                <Button variant="outline" size="sm" onClick={() => handleActivateWorkflowVersion(def.id, version.id)} disabled={isSavingAll || isSavingData}>
                                    <ShieldCheck className="mr-2 h-4 w-4"/>Set Active
                                </Button>}
                            {version.isActive &&
                                <Button variant="ghost" size="sm" disabled className="text-green-600 cursor-default">
                                    <ShieldCheck className="mr-2 h-4 w-4"/>Currently Active
                                </Button>}
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
      />

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
