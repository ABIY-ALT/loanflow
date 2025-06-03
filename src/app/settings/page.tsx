
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Check, PlusCircle, Trash2, AlertTriangle, Save, Clock, GripVertical, FileText, Users, Percent, Copy, Eye, Edit, History, Type as TypeIcon, ShieldCheck, ShieldOff, Loader2 } from 'lucide-react';
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
import type { WorkflowDefinition, WorkflowVersion, WorkflowStageDefinition, Department } from '@/types/loan';
import { getWorkflowDefinitions, saveWorkflowDefinitions, getDepartments, addWorkflowDefinitionToFirestore } from '@/services/loan-service';
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


const createNewStage = (name: string, departmentName: string, timeline: number, weight: number, order: number): WorkflowStageDefinition => ({
  id: `stage-custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, // Client-side ID for new stages before full save
  name,
  responsibleDepartment: departmentName,
  defaultTimelineDays: timeline,
  requiredDocumentNames: [],
  percentageWeight: weight,
  order: order,
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
  onRemoveRequiredDocument: (versionId: string, stageId: string, docName: string) => void;
  onRequiredDocumentNameChange: (versionId: string, stageId: string, docName: string, newName: string) => void;
}

function WorkflowStageConfigItem({
  stage,
  workflowVersionId,
  departments,
  onStageChange,
  onRemoveStage,
  onAddRequiredDocument,
  onRemoveRequiredDocument,
  onRequiredDocumentNameChange,
}: WorkflowStageConfigItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 100 : 'auto', opacity: isDragging ? 0.8 : 1, position: 'relative' as 'relative' };
  const [newReqDocName, setNewReqDocName] = useState('');

  const handleAddDoc = () => {
    if (newReqDocName.trim()) {
      onAddRequiredDocument(workflowVersionId, stage.id, newReqDocName.trim());
      setNewReqDocName('');
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
            <Users className="h-4 w-4"/>{stage.responsibleDepartment || 'N/A'} | <Clock className="h-4 w-4"/>{stage.defaultTimelineDays}d | <Percent className="h-4 w-4" />{stage.percentageWeight || 0}% | <FileText className="h-4 w-4"/>{stage.requiredDocumentNames.length} doc(s)
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="space-y-6 p-4 bg-background rounded-b-md">
        <div className="grid md:grid-cols-3 gap-4">
          <div><Label htmlFor={`s-name-${stage.id}`}>Stage Name</Label><Input id={`s-name-${stage.id}`} value={stage.name} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onChange={(e) => onStageChange(workflowVersionId, stage.id, 'name', e.target.value)} className="mt-1"/></div>
          <div>
            <Label htmlFor={`s-dept-${stage.id}`}>Responsible Department</Label>
            <Select value={stage.responsibleDepartment} onValueChange={(value) => onStageChange(workflowVersionId, stage.id, 'responsibleDepartment', value)} >
                <SelectTrigger id={`s-dept-${stage.id}`} className="mt-1" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                    <SelectValue placeholder="Select Department" />
                </SelectTrigger>
                <SelectContent>
                    {departments.length === 0 && <SelectItem value="no-depts" disabled>No departments found</SelectItem>}
                    {departments.map(dept => <SelectItem key={`s-dept-item-${stage.id}-${dept.id}`} value={dept.name}>{dept.name}</SelectItem>)}
                </SelectContent>
            </Select>
          </div>
          <div><Label htmlFor={`s-time-${stage.id}`}>Timeline (days)</Label><Input id={`s-time-${stage.id}`} type="number" value={stage.defaultTimelineDays} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onChange={(e) => onStageChange(workflowVersionId, stage.id, 'defaultTimelineDays', parseInt(e.target.value,10) || 0)} className="mt-1" min="0"/></div>
          <div><Label htmlFor={`s-weight-${stage.id}`}>Weight (%)</Label><Input id={`s-weight-${stage.id}`} type="number" value={stage.percentageWeight} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onChange={(e) => onStageChange(workflowVersionId, stage.id, 'percentageWeight', parseInt(e.target.value,10) || 0)} className="mt-1" min="0" max="100"/></div>
        </div>
        <Separator />
        <div>
          <h5 className="text-md font-medium mb-2">Required Documents for this Stage</h5>
          {stage.requiredDocumentNames.length === 0 && (<p className="text-sm text-muted-foreground">No documents required.</p>)}
          <ul className="space-y-2">
            {stage.requiredDocumentNames.map((docName, index) => (
              <li key={`${stage.id}-doc-${index}`} className="flex items-center gap-2 p-2 border rounded-md">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <Input value={docName} onChange={(e) => onRequiredDocumentNameChange(workflowVersionId, stage.id, docName, e.target.value)} className="flex-grow text-sm" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}/>
                <Button variant="ghost" size="icon" onClick={() => onRemoveRequiredDocument(workflowVersionId, stage.id, docName)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </li>
            ))}
          </ul>
          <div className="flex items-end gap-2 mt-4">
            <div className="flex-grow">
              <Label htmlFor={`new-req-doc-${stage.id}`}>New Document Name</Label>
              <Input id={`new-req-doc-${stage.id}`} value={newReqDocName} onChange={(e) => setNewReqDocName(e.target.value)} placeholder="e.g., Passport" className="mt-1" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}/>
            </div>
            <Button onClick={handleAddDoc} size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Add Document</Button>
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
  isOpen, onOpenChange, workflowDefinition, versionToEdit, departments, onSaveVersion,
}: EditWorkflowVersionDialogProps) {
  const [editedVersion, setEditedVersion] = useState<WorkflowVersion | null>(null);
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const { toast } = useToast();

  const [newStageName, setNewStageName] = useState('');
  const [newStageDept, setNewStageDept] = useState<string>(departments.length > 0 ? departments[0].name : '');
  const [newStageTimeline, setNewStageTimeline] = useState(3);
  const [newStageWeight, setNewStageWeight] = useState(10);

  useEffect(() => {
    if (versionToEdit) {
      setEditedVersion(JSON.parse(JSON.stringify(versionToEdit)));
      if (departments.length > 0 && !newStageDept) {
        setNewStageDept(departments[0].name);
      }
    } else {
      setEditedVersion(null);
    }
  }, [versionToEdit, isOpen, departments, newStageDept]);

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
        toast({ title: "Error", description: "New stage name is required.", variant: "destructive"});
        return;
    }
    if(!newStageDept.trim()){
        toast({ title: "Error", description: "A department must be selected for the new stage.", variant: "destructive"});
        return;
    }

    const newOrder = editedVersion.stages.length;
    const newStage = createNewStage(newStageName, newStageDept, newStageTimeline, newStageWeight, newOrder);
    setEditedVersion(prev => {
      if (!prev) return null;
      return { ...prev, stages: updateStageOrder([...prev.stages, newStage]) };
    });
    setNewStageName('');
    setNewStageDept(departments.length > 0 ? departments[0].name : '');
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
    setEditedVersion(prev => {
        if(!prev) return null;
        return { ...prev, stages: prev.stages.map(s => s.id === stageId ? {...s, requiredDocumentNames: [...s.requiredDocumentNames, docName]} : s)};
    });
  };
  const handleInternalRemoveReqDoc = (versionId: string, stageId: string, docName: string) => {
     setEditedVersion(prev => {
        if(!prev) return null;
        return { ...prev, stages: prev.stages.map(s => s.id === stageId ? {...s, requiredDocumentNames: s.requiredDocumentNames.filter(name => name !== docName)} : s)};
    });
  };
  const handleInternalReqDocNameChange = (versionId: string, stageId: string, oldDocName: string, newDocName: string) => {
    setEditedVersion(prev => {
        if(!prev) return null;
        return { ...prev, stages: prev.stages.map(s => s.id === stageId ? {...s, requiredDocumentNames: s.requiredDocumentNames.map(name => name === oldDocName ? newDocName : name)} : s)};
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
          <DialogTitle>Edit Workflow Version {editedVersion.versionNumber} for: {workflowDefinition.name} ({workflowDefinition.loanType})</DialogTitle>
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
                        departments={departments}
                        onStageChange={handleInternalStageChange}
                        onRemoveStage={handleInternalRemoveStage}
                        onAddRequiredDocument={handleInternalAddReqDoc}
                        onRemoveRequiredDocument={handleInternalRemoveReqDoc}
                        onRequiredDocumentNameChange={handleInternalReqDocNameChange}
                    />
                    ))}
                </Accordion>
                </SortableContext>
            </DndContext>
            <Separator />
            <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                <h5 className="font-medium">Add New Stage to this Version</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                    <div><Label htmlFor="new-s-name">Stage Name</Label><Input id="new-s-name" value={newStageName} onChange={e=>setNewStageName(e.target.value)} placeholder="New Stage Name" /></div>
                    <div>
                        <Label htmlFor="new-s-dept">Responsible Dept.</Label>
                        <Select value={newStageDept} onValueChange={(value) => setNewStageDept(value)}>
                            <SelectTrigger id="new-s-dept" className="mt-1"><SelectValue placeholder="Select Department" /></SelectTrigger>
                            <SelectContent>
                                {departments.length === 0 && <SelectItem value="no-depts-new" disabled>No departments found</SelectItem>}
                                {departments.map(dept => <SelectItem key={`new-stage-dept-option-${dept.id}`} value={dept.name}>{dept.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div><Label htmlFor="new-s-time">Timeline (days)</Label><Input id="new-s-time" type="number" value={newStageTimeline} onChange={e=>setNewStageTimeline(parseInt(e.target.value,10)||0)} min="0"/></div>
                    <div><Label htmlFor="new-s-weight">Weight (%)</Label><Input id="new-s-weight" type="number" value={newStageWeight} onChange={e=>setNewStageWeight(parseInt(e.target.value,10)||0)} min="0" max="100"/></div>
                    <Button onClick={handleInternalAddStageToVersion} size="sm" className="sm:col-span-2" disabled={departments.length === 0 && !newStageDept.trim()}><PlusCircle className="mr-2 h-4 w-4"/>Add Stage to Version</Button>
                </div>
                 {departments.length === 0 && <p className="text-xs text-destructive mt-1">Cannot add stage: No departments are configured. Please add departments via Settings &gt; Manage Departments.</p>}
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
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSavingData, setIsSavingData] = useState(false);
  const [workflowDefinitions, setWorkflowDefinitions] = useState<WorkflowDefinition[]>([]);
  const [departments, setDepartments] = useState<DepartmentObject[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [isEditVersionDialogOpen, setIsEditVersionDialogOpen] = useState(false);
  const [currentWorkflowDefForEdit, setCurrentWorkflowDefForEdit] = useState<WorkflowDefinition | null>(null);
  const [currentVersionToEdit, setCurrentVersionToEdit] = useState<WorkflowVersion | null>(null);

  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [newWorkflowLoanType, setNewWorkflowLoanType] = useState('');
  const [newWorkflowDescription, setNewWorkflowDescription] = useState('');

  const [enableNotifications, setEnableNotifications] = useState(true);
  const [overdueThreshold, setOverdueThreshold] = useState(2);
  const [isSavingAll, setIsSavingAll] = useState(false);

  const fetchInitialData = useCallback(async () => {
      setIsLoadingData(true);
      setError(null);
      try {
        const [wfResult, deptResult] = await Promise.all([
          getWorkflowDefinitions(),
          getDepartments()
        ]);

        if (wfResult.error) throw new Error(`Workflows: ${wfResult.error}`);
        setWorkflowDefinitions(wfResult.workflows || []);


        if (deptResult.error) throw new Error(`Departments: ${deptResult.error}`);
        setDepartments(deptResult.departments || []);

      } catch (err: any) {
        const errorMessage = err.message || "Failed to load settings data.";
        setError(errorMessage);
        setWorkflowDefinitions([]);
        setDepartments([]);
        toast({title: "Error Loading Settings", description: errorMessage, variant: "destructive", duration: 9000});
      } finally {
        setIsLoadingData(false);
      }
    }, [toast]);


  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);


  const handleActivateWorkflowVersion = (definitionIdToActivate: string, versionIdToActivate: string) => {
    const targetDef = workflowDefinitions.find(d => d.id === definitionIdToActivate);
    if (!targetDef) return;

    setWorkflowDefinitions(prevDefs =>
      prevDefs.map(def => {
        if (def.loanType === targetDef.loanType) {
          return {
            ...def,
            versions: def.versions.map(v => ({
              ...v,
              isActive: (v.id === versionIdToActivate && def.id === definitionIdToActivate)
            }))
          };
        }
        return def;
      })
    );
    const activatedVersion = targetDef.versions.find(v => v.id === versionIdToActivate);
    toast({ title: "Success (Local)", description: `Workflow Version ${activatedVersion?.versionNumber} for '${targetDef.name}' (${targetDef.loanType}) is now marked as active. Click "Save All Settings" to persist.` });
  };


  const handleOpenEditVersionDialog = (def: WorkflowDefinition, version: WorkflowVersion) => {
    setCurrentWorkflowDefForEdit(def);
    setCurrentVersionToEdit(version);
    setIsEditVersionDialogOpen(true);
  };

  const handleAddNewVersion = (definitionId: string) => {
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

        let makeNewActive = newVersion.isActive;
        if (!def.versions.some(v => v.isActive)) {
            makeNewActive = true;
        }

        const updatedVersions = def.versions.map(v => ({...v, isActive: makeNewActive && v.id === newVersion.id ? true : (makeNewActive ? false : v.isActive) }));

        return { ...def, versions: [...updatedVersions, {...newVersion, isActive: makeNewActive}].sort((a,b) => b.versionNumber - a.versionNumber) };
      }
      return def;
    }));
    toast({title: "New Version Added (Local)", description: "Empty new version added. Edit to add stages. Active status set if no other version was active for this loan type. Remember to Save All Settings."});
  };

  const handleSaveVersion = (definitionId: string, updatedVersion: WorkflowVersion) => {
     setWorkflowDefinitions(prevDefs => prevDefs.map(def => {
       if (def.id === definitionId) {
         let versionsToUpdate = def.versions.map(v => v.id === updatedVersion.id ? updatedVersion : v);
         if (updatedVersion.isActive) {
            versionsToUpdate = versionsToUpdate.map(v => ({
                ...v,
                isActive: v.id === updatedVersion.id
            }));
         }
         return { ...def, versions: versionsToUpdate.sort((a,b) => b.versionNumber - a.versionNumber) };
       }
       return def;
     }));
     toast({title: "Version Changes Applied (Local)", description: `Version ${updatedVersion.versionNumber} changes staged. Save all settings to persist.`});
  };

  const handleAddNewWorkflowDefinition = async () => {
    if (!newWorkflowName.trim() || !newWorkflowLoanType.trim()) {
        toast({ title: "Validation Error", description: "Workflow name and loan type are required.", variant: "destructive", duration: 9000 });
        return;
    }
    const existingForLoanType = workflowDefinitions.find(wd => wd.loanType.trim().toLowerCase() === newWorkflowLoanType.trim().toLowerCase());
    if(existingForLoanType){
        toast({ title: "Validation Error", description: `A workflow definition for loan type '${newWorkflowLoanType}' already exists: '${existingForLoanType.name}'. Each loan type should have one definition container. Add versions to it.`, variant: "destructive", duration: 9000 });
        return;
    }

    setIsSavingData(true);
    const definitionData: Omit<WorkflowDefinition, 'id' | 'versions' | 'createdAt' | 'updatedAt'> = {
        name: newWorkflowName,
        loanType: newWorkflowLoanType.trim(),
        description: newWorkflowDescription,
    };

    try {
      const result = await addWorkflowDefinitionToFirestore(definitionData);
      if (result.error || !result.id) {
          toast({ title: "Error Adding Workflow", description: result.error || "Failed to save new workflow definition to Firestore.", variant: "destructive", duration: 9000 });
      } else {
          const newDefinitionFromDb: WorkflowDefinition = {
              id: result.id,
              ...definitionData,
              versions: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
          };
          setWorkflowDefinitions(prev => [...prev, newDefinitionFromDb]);
          setNewWorkflowName('');
          setNewWorkflowLoanType('');
          setNewWorkflowDescription('');
          toast({ title: "Workflow Definition Added", description: `Workflow '${newDefinitionFromDb.name}' for '${newDefinitionFromDb.loanType}' saved to Firestore.` });
      }
    } catch (error: any) {
        let errorMessage = "An unexpected error occurred while adding workflow definition.";
        if (error && typeof error.message === 'string') {
            errorMessage = error.message;
        }
        toast({
            title: "Action Failed",
            description: `Error: ${errorMessage}`,
            variant: "destructive",
            duration: 9000,
        });
    } finally {
        setIsSavingData(false);
    }
  };

  const handleSaveChanges = async () => {
    setIsSavingAll(true);
    setError(null);
    try {
        const result = await saveWorkflowDefinitions(workflowDefinitions);
        if (result.error) {
            throw new Error(result.error);
        }
        toast({ title: "All Settings Saved to Firestore", description: "Workflow configurations have been persisted.", action: <Check className="h-5 w-5 text-green-500" /> });
        await fetchInitialData();
    } catch (err: any) {
        let errorMessage = "Failed to save settings to Firestore.";
        if (err && typeof err.message === 'string') {
            errorMessage = err.message;
             if (err.message.includes("query requires an index")) {
                errorMessage += " Please check Firestore console for index creation link.";
            }
        }
        setError(errorMessage);
        toast({ title: "Saving Failed", description: `Error: ${errorMessage}`, variant: "destructive", duration: 9000 });
    } finally {
        setIsSavingAll(false);
    }
  };

  if (isLoadingData) {
    return (
        <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="ml-3 text-lg">Loading settings...</p>
        </div>
    );
  }
  if (error && workflowDefinitions.length === 0 && departments.length === 0) {
     return (
        <div className="space-y-6 p-4 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
            <h2 className="text-2xl font-semibold text-destructive">Failed to Load Settings Data</h2>
            <p className="text-muted-foreground">{error}</p>
            <p className="text-sm text-muted-foreground mt-2">Please ensure Firestore is configured and reachable. Check console for details and ensure required indexes are built.</p>
            <Button onClick={() => window.location.reload()}>Try Reloading</Button>
        </div>
    );
  }


  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Define workflow definitions for loan types. Each definition can have multiple versions.
          Only one version per loan type can be active for new applications.
          Ensure departments are set up via Settings &gt; Manage Departments for stage assignment.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workflow Definitions</CardTitle>
          <CardDescription>Manage workflows for different loan types. New loans will use the active version for their specific loan type. </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {workflowDefinitions.length === 0 && !isLoadingData && (
            <div className="p-4 text-center border rounded-md bg-muted/50">
                <p className="text-muted-foreground mb-2">No workflow definitions found.</p>
                <p className="text-sm text-muted-foreground">Please add one below or check Firestore connection and console for errors.</p>
            </div>
          )}
          {workflowDefinitions.map(def => (
            <Card key={def.id} className="shadow-sm">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{def.name} (Loan Type: {def.loanType})</CardTitle>
                    <CardDescription>{def.description || "No description."}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <h4 className="font-medium text-sm">Versions (Latest first):</h4>
                {def.versions.length === 0 && <p className="text-sm text-muted-foreground">No versions defined for this workflow. Add one below.</p>}
                {def.versions.sort((a,b) => b.versionNumber - a.versionNumber).map(version => (
                  <div key={version.id} className={`flex flex-col sm:flex-row justify-between sm:items-center p-3 border rounded-md gap-2 ${version.isActive ? "border-primary bg-primary/5" : "bg-muted/30"}`}>
                    <div>
                      <div className="font-semibold flex items-center">
                        Version {version.versionNumber}
                        {version.isActive && <Badge className="ml-2 bg-green-600 text-white">Active</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">Created: {new Date(version.createdAt).toLocaleDateString()} | Stages: {version.stages.length}</p>
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
            </Card>
          ))}
          <Separator />
           <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
                <h4 className="font-medium text-lg">Add New Workflow Definition</h4>
                <div className="grid md:grid-cols-2 gap-4">
                    <div><Label htmlFor="new-wf-name">Workflow Definition Name</Label><Input id="new-wf-name" value={newWorkflowName} onChange={e=>setNewWorkflowName(e.target.value)} placeholder="e.g., Small Business Loan Process" disabled={isSavingAll || isSavingData}/></div>
                    <div><Label htmlFor="new-wf-loantype">Loan Type (e.g., Personal, Mortgage, Auto)</Label><Input id="new-wf-loantype" value={newWorkflowLoanType} onChange={e=>setNewWorkflowLoanType(e.target.value)} placeholder="e.g., Small Business Loan" disabled={isSavingAll || isSavingData}/></div>
                </div>
                <div><Label htmlFor="new-wf-desc">Description</Label><Textarea id="new-wf-desc" value={newWorkflowDescription} onChange={e=>setNewWorkflowDescription(e.target.value)} placeholder="Brief description of this workflow definition" disabled={isSavingAll || isSavingData}/></div>
                <Button onClick={handleAddNewWorkflowDefinition} disabled={isSavingAll || isSavingData}>
                    {(isSavingAll || isSavingData) && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Add Workflow Definition to Firestore
                </Button>
            </div>
        </CardContent>
      </Card>

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
        {isSavingAll ? "Saving..." : "Save All Settings to Firestore"}
        </Button></div>
    </div>
  );
}

    