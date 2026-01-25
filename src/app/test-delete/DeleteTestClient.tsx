'use client';

import { useState } from 'react';
import { deleteTask, deleteFile } from '@/app/actions';
import { useRouter } from 'next/navigation';

interface Task {
    id: string;
    title: string;
}

interface File {
    id: string;
    name: string;
    type: string;
}

export default function DeleteTestClient({ tasks, files }: { tasks: Task[], files: File[] }) {
    const router = useRouter();
    const [result, setResult] = useState<string>('');
    const [selectedTaskId, setSelectedTaskId] = useState<string>(tasks[0]?.id || '');
    const [selectedFileId, setSelectedFileId] = useState<string>(files[0]?.id || '');

    const testDeleteTask = async () => {
        if (!selectedTaskId) {
            setResult('No task selected');
            return;
        }

        try {
            setResult('Deleting task...');
            const res = await deleteTask(selectedTaskId);
            setResult(JSON.stringify(res, null, 2));

            if (res.success) {
                setTimeout(() => router.refresh(), 1000);
            }
        } catch (error) {
            setResult('Error: ' + String(error));
        }
    };

    const testDeleteFile = async () => {
        if (!selectedFileId) {
            setResult('No file selected');
            return;
        }

        try {
            setResult('Deleting file...');
            const res = await deleteFile(selectedFileId);
            setResult(JSON.stringify(res, null, 2));

            if (res.success) {
                setTimeout(() => router.refresh(), 1000);
            }
        } catch (error) {
            setResult('Error: ' + String(error));
        }
    };

    return (
        <div className="p-8 bg-gray-900 min-h-screen text-white">
            <h1 className="text-2xl font-bold mb-4">Delete Function Test</h1>

            <div className="grid grid-cols-2 gap-8">
                <div>
                    <h2 className="text-xl font-semibold mb-2">Tasks</h2>
                    <select
                        value={selectedTaskId}
                        onChange={(e) => setSelectedTaskId(e.target.value)}
                        className="w-full p-2 bg-gray-800 rounded mb-4"
                    >
                        {tasks.map(task => (
                            <option key={task.id} value={task.id}>
                                {task.title}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={testDeleteTask}
                        className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500 w-full"
                    >
                        Delete Selected Task
                    </button>
                </div>

                <div>
                    <h2 className="text-xl font-semibold mb-2">Files</h2>
                    <select
                        value={selectedFileId}
                        onChange={(e) => setSelectedFileId(e.target.value)}
                        className="w-full p-2 bg-gray-800 rounded mb-4"
                    >
                        {files.map(file => (
                            <option key={file.id} value={file.id}>
                                {file.name} ({file.type})
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={testDeleteFile}
                        className="px-4 py-2 bg-green-600 rounded hover:bg-green-500 w-full"
                    >
                        Delete Selected File
                    </button>
                </div>
            </div>

            <pre className="mt-8 p-4 bg-gray-800 rounded overflow-auto">
                {result || 'Select an item and click delete to test'}
            </pre>

            <div className="mt-4">
                <a href="/" className="text-blue-400 hover:text-blue-300">← Back to Dashboard</a>
            </div>
        </div>
    );
}
