export type ManagerCommandCenter={
  serverNow:string;
  localDate:string;
  teamMembers:number;
  activeTours:number;
  submittedToursToday:number;
  shortDaysToday:number;
  activeJointWork:number;
  pending:{tourApprovals:number;gpsExceptions:number;weeklyTimesheets:number;leaves:number;expenses:number};
  queues:{
    tourApprovals:Array<{id:string;employeeId:string;weekStart:string}>;
    gpsExceptions:Array<{id:string;employeeId:string;workDate:string}>;
    weeklyTimesheets:Array<{id:string;employeeId:string;weekStart:string}>;
    leaves:Array<{id:string;employeeId:string;startDate:string;endDate:string}>;
    expenses:Array<{id:string;employeeId:string;workDate:string;totalAmount:number;currencyCode:string}>;
  };
};
export type ManagerCommandRepository={get(t:string,token:string):Promise<ManagerCommandCenter>};
export function createManagerCommandService(r:ManagerCommandRepository){return{get:(t:string,token:string)=>r.get(t,token)}}
