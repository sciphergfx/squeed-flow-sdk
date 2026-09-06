import NodeView from "./NodeView";
import { NodeText } from "./nodeText";
import { CompactObjectView } from "./CompactObjectView";
import { ObjectNodeView } from "./ObjectNodeView";

const text = props => <CompactObjectView {...props} renderCompact={NodeText} />;
const arrayView = props => <CompactObjectView {...props} />;
const ParentContainerView = props => <NodeView {...props}>{() => null}</NodeView>;

text.displayName = "text";
arrayView.displayName = "arrayView";
ParentContainerView.displayName = "ParentContainerView";

export default { objectView: ObjectNodeView, arrayView, text, parentContainer: ParentContainerView };
