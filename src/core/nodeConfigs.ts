const initialDataValues = {
  label: "Untitled",
  description: "",
  isTask: false,
  isLocked: false,
};

export const nodePlainTextConfig: any = {
  id: null,
  type: "text",
  data: {
    ...initialDataValues,
    viewProps: {
      width: "max-content !important",
      maxWidth: 700,
      height: "100%",
      borderColor: "transparent",
      borderRadius: 25,
      borderWidth: 0,
      boxShadow: "none",
      textOverflow: "ellipsis",
      fontWeight: "bold",
      textColor: "gray.800",
      textAlign: "center",
    },
  },
};

export const nodeJsonObjectConfig: any = {
  id: null,
  type: "objectView",
  data: {
    ...initialDataValues,
    headerTitle: null,
    viewProps: {
      width: "100%",
      borderWidth: 2,
      borderRadius: 25,
      height: "100%",
      justifyContent: "space-between",
      flexDirection: "row",
      textColor: "gray.900",
    },
  },
};

export const nodeArrayConfig: any = {
  id: null,
  type: "arrayView",
  data: {
    ...initialDataValues,
    viewProps: {
      width: "max-content !important",
      maxWidth: 700,
      height: "100%",
      textAlign: "center",
      borderRadius: 25,
      fontSize: "5xl",
      borderWidth: 2,
      textOverflow: "ellipsis",
      wordBreak: "keep-all",
      fontWeight: "bold",
      textColor: "gray.900",
      placeholder: "Start Typing",
    },
  },
};

export const nodeWorkflowStepConfig: any = {
  id: null,
  type: "workflowStep",
  data: {
    ...initialDataValues,
    viewProps: {
      width: "max-content !important",
      maxWidth: 350,
      minWidth: 280,
      height: "100%",
      borderRadius: 15,
      borderWidth: 3,
    },
  },
};