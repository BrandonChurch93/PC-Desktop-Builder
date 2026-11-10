import { store, type DialogName } from '../state/store';

export const openDialog = (d: DialogName) => store.setState({ ui: { ...store.getState().ui, dialog: d, menu: false } });
export const closeDialog = () => store.setState({ ui: { ...store.getState().ui, dialog: null } });
export const setUi = (patch: Partial<ReturnType<typeof store.getState>['ui']>) => store.setState({ ui: { ...store.getState().ui, ...patch } });
