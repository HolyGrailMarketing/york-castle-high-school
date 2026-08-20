import { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import type { Course } from '../types';
import './Courses.css';
import PageHelp from '../components/PageHelp';

const Courses = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [poolFilter, setPoolFilter] = useState('');

  useEffect(() => {
    fetchCourses();
  }, [poolFilter]);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (poolFilter) params.pool = poolFilter;
      const data = await apiService.getCourses(params);
      setCourses(data.courses);
    } catch (error) {
      console.error('Failed to fetch courses:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading courses...</div>;
  }

  return (
    <div className="courses-page">
      <PageHelp pageKey="courses" />
      <div className="page-header">
        <h1>Courses</h1>
        <div className="filters">
          <select
            value={poolFilter}
            onChange={(e) => setPoolFilter(e.target.value)}
            className="filter-select"
          >
            <option value="">All Pools</option>
            <option value="1">Pool 1</option>
            <option value="2">Pool 2</option>
            <option value="3">Pool 3</option>
            <option value="4">Pool 4</option>
            <option value="5">Pool 5</option>
            <option value="6">Pool 6</option>
          </select>
        </div>
      </div>

      <div className="courses-list">
        <table className="data-table data-table--stack">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Pool</th>
              <th>Teacher</th>
              <th>Enrolled</th>
              <th>Capacity</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((course) => (
              <tr key={course.id}>
                <td data-label="Code">{course.code}</td>
                <td data-label="Name" className="col-name">{course.name}</td>
                <td data-label="Pool">{course.pool || 'N/A'}</td>
                <td data-label="Teacher">{course.teacher || 'N/A'}</td>
                <td data-label="Enrolled">{course.enrolled}</td>
                <td data-label="Capacity">{course.capacity || 'Unlimited'}</td>
                <td data-label="Status">
                  <span className={course.isActive ? 'status-active' : 'status-inactive'}>
                    {course.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Courses;





