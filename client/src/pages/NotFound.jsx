import { Link } from 'react-router-dom';
import { Button, EmptyState } from '../components/common/ui.jsx';
import { Reading } from '../components/common/PageShell.jsx';

export default function NotFound() {
  return (
    <Reading>
      <EmptyState title="Page not found" action={<Link to="/"><Button>Go home</Button></Link>}>
        That page doesn’t exist or may have moved.
      </EmptyState>
    </Reading>
  );
}
