import { registerBlockType } from '@wordpress/blocks';
import metadata from './block.json';
import Edit from './edit';
import save from './save';
import './editor.css';

console.log('NewOSM: Attempting to register block', metadata.name);

const registeredBlock = registerBlockType(metadata, {
	edit: Edit,
	save,
});

console.log('NewOSM: Block registration result', registeredBlock ? 'SUCCESS' : 'FAILED');
