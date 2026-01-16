// Session manager placeholder to resolve dependencies
export interface SessionManagerInterface {
  disabled: true;
}

export class SessionManager implements SessionManagerInterface {
  disabled = true as const;
  
  createSession() {
    throw new Error("Session manager disabled - missing dependencies");
  }
  
  getSession() {
    throw new Error("Session manager disabled - missing dependencies");
  }
  
  updateSession() {
    throw new Error("Session manager disabled - missing dependencies");
  }
  
  deleteSession() {
    throw new Error("Session manager disabled - missing dependencies");
  }
}

export const sessionManager = new SessionManager();
